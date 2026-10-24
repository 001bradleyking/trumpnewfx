<?php

namespace App\Http\Controllers;

use App\Mail\SecurityAlertMail;
use App\Mail\TwoFactorCodeMail;
use App\Models\AuditEvent;
use App\Models\TwoFactorChallenge;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Laravel\Socialite\Facades\Socialite;
use Throwable;

class AuthController
{
    public function redirectToGoogle()
    {
        if (! config('services.google.client_id') || ! config('services.google.client_secret') || ! config('services.google.redirect')) {
            return redirect($this->frontendUrl().'?auth=google_unavailable');
        }

        return Socialite::driver('google')->scopes(['openid', 'email', 'profile'])->redirect();
    }

    public function handleGoogleCallback(Request $request)
    {
        try {
            $google = Socialite::driver('google')->user();
            $profile = $google->getRaw();
            $email = Str::lower(trim((string) $google->getEmail()));
            $emailVerified = ($profile['email_verified'] ?? $profile['verified_email'] ?? false) === true;

            if (! $google->getId() || ! filter_var($email, FILTER_VALIDATE_EMAIL) || ! $emailVerified) {
                return redirect($this->frontendUrl().'?auth=google_unverified');
            }

            $user = User::where('google_id', $google->getId())->first();
            if (! $user) {
                $user = User::where('email', $email)->first();
                if ($user && $user->google_id && ! hash_equals($user->google_id, (string) $google->getId())) {
                    return redirect($this->frontendUrl().'?auth=google_account_conflict');
                }
                if (! $user) {
                    $user = User::create([
                        'name' => trim((string) ($google->getName() ?: $email)),
                        'email' => $email,
                        'password' => Str::random(64),
                        'google_id' => (string) $google->getId(),
                        'is_active' => true,
                    ]);
                } else {
                    $user->forceFill(['google_id' => (string) $google->getId()])->save();
                }
            }

            if (! $user->is_active) {
                AuditEvent::record($request, 'login_blocked_inactive', $user->id);

                return redirect($this->frontendUrl().'?auth=google_account_unavailable');
            }

            $user->forceFill(['email_verified_at' => $user->email_verified_at ?? now()])->save();
            AuditEvent::record($request, 'google_login_code_requested', $user->id);
            $this->beginChallenge($request, $user, 'login');

            return redirect($this->frontendUrl().'?auth=google_verify');
        } catch (Throwable $exception) {
            Log::warning('NEWS FX Google sign-in failed.', ['exception' => get_class($exception)]);

            return redirect($this->frontendUrl().'?auth=google_failed');
        }
    }

    public function csrf(Request $request): JsonResponse
    {
        return response()->json(['csrf_token' => $request->session()->token()]);
    }

    public function register(Request $request): JsonResponse
    {
        if (Auth::check()) {
            return response()->json(['message' => 'Une session est déjà ouverte sur cet appareil.'], 409);
        }

        $request->merge(['email' => Str::lower(trim((string) $request->input('email', '')))]);
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:100'],
            'email' => ['required', 'string', 'email:rfc', 'max:254', 'unique:users,email'],
            'password' => ['required', 'confirmed', PasswordRule::min(10)->letters()->mixedCase()->numbers()],
        ]);

        $user = User::create([
            'name' => trim($data['name']),
            'email' => Str::lower($data['email']),
            'password' => $data['password'],
        ]);
        AuditEvent::record($request, 'registration_created', $user->id);

        try {
            $this->beginChallenge($request, $user, 'registration');
        } catch (Throwable $exception) {
            Log::error('NEWS FX could not send a registration code.', ['user_id' => $user->id, 'exception' => get_class($exception)]);
            AuditEvent::record($request, 'registration_code_failed', $user->id);

            return response()->json([
                'message' => 'Votre compte est créé, mais le code e-mail n’a pas pu être envoyé. Réessayez en vous connectant dans quelques instants.',
            ], 503);
        }

        return response()->json([
            'requires_2fa' => true,
            'message' => 'Un code de vérification a été envoyé à votre adresse e-mail.',
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        if (Auth::check()) {
            return response()->json(['message' => 'Une session est déjà ouverte sur cet appareil.'], 409);
        }

        $data = $request->validate([
            'email' => ['required', 'email:rfc', 'max:254'],
            'password' => ['required', 'string', 'max:200'],
        ]);
        $email = Str::lower($data['email']);
        $key = 'login:'.sha1($email.'|'.$request->ip());

        if (RateLimiter::tooManyAttempts($key, 8)) {
            return response()->json(['message' => 'Trop de tentatives. Réessayez dans quelques minutes.'], 429);
        }

        $user = User::where('email', $email)->first();
        if (! $user || ! $user->is_active || ! Hash::check($data['password'], $user->password)) {
            RateLimiter::hit($key, 300);
            AuditEvent::record($request, 'login_failed');

            return response()->json(['message' => 'Adresse e-mail ou mot de passe incorrect.'], 422);
        }

        RateLimiter::clear($key);
        AuditEvent::record($request, 'login_code_requested', $user->id);
        try {
            $this->beginChallenge($request, $user, 'login');
        } catch (Throwable $exception) {
            Log::error('NEWS FX could not send a login code.', ['user_id' => $user->id, 'exception' => get_class($exception)]);
            AuditEvent::record($request, 'login_code_failed', $user->id);

            return response()->json([
                'message' => 'Le code e-mail n’a pas pu être envoyé. Vérifiez la configuration SMTP ou réessayez dans quelques instants.',
            ], 503);
        }

        return response()->json([
            'requires_2fa' => true,
            'message' => 'Un code de vérification a été envoyé à votre adresse e-mail.',
        ]);
    }

    public function verify(Request $request): JsonResponse
    {
        $data = $request->validate(['code' => ['required', 'digits:6']]);
        $userId = $request->session()->get('pending_auth_user');
        $purpose = $request->session()->get('pending_auth_purpose');

        $challenge = TwoFactorChallenge::where('user_id', $userId)
            ->where('purpose', $purpose)
            ->latest('id')
            ->first();

        if (! $challenge || $challenge->expires_at->isPast() || $challenge->attempts >= 5) {
            $this->clearPending($request);

            return response()->json(['message' => 'Ce code a expiré. Recommencez la connexion ou demandez un nouveau code.'], 422);
        }

        if (! Hash::check($data['code'], $challenge->code_hash)) {
            $challenge->increment('attempts');
            AuditEvent::record($request, 'two_factor_failed', (int) $userId);

            $alertClaimed = TwoFactorChallenge::whereKey($challenge->id)
                ->whereNull('alerted_at')
                ->update(['alerted_at' => now(), 'updated_at' => now()]);

            if ($alertClaimed === 1) {
                try {
                    Mail::to($challenge->user->email)->send(new SecurityAlertMail);
                } catch (Throwable $exception) {
                    Log::warning('NEWS FX could not send a failed-code security alert.', ['user_id' => $userId, 'exception' => $exception->getMessage()]);
                }
            }

            return response()->json(['message' => 'Code incorrect. Une alerte de sécurité a été envoyée à votre adresse e-mail.'], 422);
        }

        $user = $challenge->user;
        if (! $user->is_active) {
            $challenge->delete();
            $this->clearPending($request);

            return response()->json(['message' => 'Ce compte est suspendu. Contactez l’assistance.'], 403);
        }
        $challenge->delete();
        TwoFactorChallenge::where('user_id', $user->id)->where('purpose', $purpose)->delete();
        $user->forceFill(['email_verified_at' => $user->email_verified_at ?? now()])->save();
        Auth::login($user);
        $request->session()->regenerate();
        $this->clearPending($request);
        AuditEvent::record($request, 'two_factor_succeeded', $user->id);

        return response()->json(['user' => $this->userPayload($user), 'message' => 'Connexion sécurisée réussie.']);
    }

    public function resend(Request $request): JsonResponse
    {
        $userId = $request->session()->get('pending_auth_user');
        $purpose = $request->session()->get('pending_auth_purpose');
        $user = User::find($userId);

        if (! $user || ! in_array($purpose, ['registration', 'login'], true)) {
            return response()->json(['message' => 'Votre demande a expiré. Recommencez.'], 422);
        }

        if (! $user->is_active) {
            $this->clearPending($request);

            return response()->json(['message' => 'Ce compte est suspendu. Contactez l’assistance.'], 403);
        }

        try {
            $this->beginChallenge($request, $user, $purpose);
        } catch (Throwable $exception) {
            Log::error('NEWS FX could not resend an authentication code.', ['user_id' => $user->id, 'exception' => get_class($exception)]);

            return response()->json([
                'message' => 'Le code e-mail n’a pas pu être envoyé. Réessayez dans quelques instants.',
            ], 503);
        }

        return response()->json(['message' => 'Un nouveau code vient d’être envoyé.']);
    }

    public function me(Request $request): JsonResponse
    {
        $user = Auth::user();
        if ($user && ! $user->is_active) {
            Auth::logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
            $user = null;
        }
        if (! $user || ! hash_equals((string) config('newsfx.admin_email'), strtolower($user->email))) {
            AuditEvent::record($request, 'visitor', $user?->id);
        }

        return response()->json(['user' => $user ? $this->userPayload($user) : null]);
    }

    public function logout(Request $request): JsonResponse
    {
        AuditEvent::record($request, 'logout', Auth::id());
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Vous êtes déconnecté.']);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'email:rfc', 'max:254']]);
        try {
            Password::sendResetLink(['email' => Str::lower($request->string('email')->toString())]);
        } catch (Throwable $exception) {
            Log::error('NEWS FX could not send a password reset email.', ['exception' => get_class($exception)]);

            return response()->json([
                'message' => 'Le service e-mail est temporairement indisponible. Réessayez dans quelques instants.',
            ], 503);
        }

        // Keep the response identical whether or not the account exists.
        return response()->json(['message' => 'Si cette adresse correspond à un compte, un lien de réinitialisation lui a été envoyé.']);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email:rfc', 'max:254'],
            'password' => ['required', 'confirmed', PasswordRule::min(10)->letters()->mixedCase()->numbers()],
        ]);

        $status = Password::reset(
            ['email' => Str::lower($data['email']), 'password' => $data['password'], 'password_confirmation' => $request->input('password_confirmation'), 'token' => $data['token']],
            function (User $user, string $password) use ($request): void {
                $user->forceFill(['password' => Hash::make($password), 'remember_token' => Str::random(60)])->save();
                if (config('session.driver') === 'database') {
                    DB::table(config('session.table', 'sessions'))->where('user_id', $user->getKey())->delete();
                }
                AuditEvent::record($request, 'password_reset', $user->id);
            }
        );

        return $status === Password::PASSWORD_RESET
            ? response()->json(['message' => 'Votre mot de passe a été modifié. Vous pouvez vous connecter.'])
            : response()->json(['message' => 'Le lien de réinitialisation est invalide ou expiré.'], 422);
    }

    private function beginChallenge(Request $request, User $user, string $purpose): void
    {
        TwoFactorChallenge::where('user_id', $user->id)->where('purpose', $purpose)->delete();
        $code = (string) random_int(100000, 999999);
        $challenge = TwoFactorChallenge::create([
            'user_id' => $user->id,
            'purpose' => $purpose,
            'code_hash' => Hash::make($code),
            'expires_at' => now()->addMinutes(10),
        ]);

        try {
            Mail::to($user->email)->send(new TwoFactorCodeMail($code, $purpose));
        } catch (Throwable $exception) {
            $challenge->delete();
            throw $exception;
        }

        $request->session()->put(['pending_auth_user' => $user->id, 'pending_auth_purpose' => $purpose]);
    }

    private function clearPending(Request $request): void
    {
        $request->session()->forget(['pending_auth_user', 'pending_auth_purpose']);
    }

    private function userPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'is_admin' => (string) config('newsfx.admin_email') !== '' && hash_equals((string) config('newsfx.admin_email'), strtolower($user->email)),
        ];
    }

    private function frontendUrl(): string
    {
        return rtrim((string) config('app.frontend_url', env('FRONTEND_URL', config('app.url'))), '/').'/';
    }
}
