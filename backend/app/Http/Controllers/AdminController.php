<?php

namespace App\Http\Controllers;

use App\Models\AuditEvent;
use App\Models\MemberPayment;
use App\Models\SiteSetting;
use App\Models\TwoFactorChallenge;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AdminController
{
    public function dashboard(): JsonResponse
    {
        return response()->json([
            'settings' => [
                'target_usd' => (int) $this->setting('target_usd', config('newsfx.default_target_usd')),
                'campaign_end_at' => $this->setting('campaign_end_at', ''),
                'campaign_status' => $this->setting('campaign_status', 'preparation'),
                'standard_duration_months' => (int) $this->setting('standard_duration_months', 0),
                'discord_enabled' => $this->setting('discord_enabled', '0') === '1',
                'discord_invite_url' => $this->setting('discord_invite_url', ''),
                'telegram_enabled' => $this->setting('telegram_enabled', '0') === '1',
                'telegram_invite_url' => $this->setting('telegram_invite_url', ''),
                'announcement_enabled' => $this->setting('announcement_enabled', '0') === '1',
                'announcement_first_name' => $this->setting('announcement_first_name', ''),
                'announcement_last_name' => $this->setting('announcement_last_name', ''),
                'announcement_fr' => $this->setting('announcement_fr', ''),
                'announcement_en' => $this->setting('announcement_en', ''),
                'announcement_es' => $this->setting('announcement_es', ''),
                'announcement_pt' => $this->setting('announcement_pt', ''),
            ],
            'payments' => MemberPayment::with('user:id,name,email')->latest()->limit(100)->get(),
            'users' => User::query()->select('id', 'name', 'email', 'email_verified_at', 'is_active', 'created_at')->latest()->limit(100)->get(),
            'events' => AuditEvent::with('user:id,name,email')->latest()->limit(200)->get(),
            'counts' => [
                'users' => User::count(),
                'verified_users' => User::whereNotNull('email_verified_at')->count(),
                'visitors' => AuditEvent::where('event_type', 'visitor')->count(),
                'login_failures' => AuditEvent::where('event_type', 'login_failed')->count(),
            ],
        ]);
    }

    public function users(Request $request): JsonResponse
    {
        $request->validate(['q' => ['nullable', 'string', 'max:120'], 'page' => ['nullable', 'integer', 'min:1']]);
        $query = User::query()->select('id', 'name', 'email', 'email_verified_at', 'is_active', 'created_at')->latest();
        $term = trim((string) $request->query('q', ''));
        if ($term !== '') {
            $query->where(fn ($builder) => $builder->where('name', 'like', '%'.$term.'%')->orWhere('email', 'like', '%'.$term.'%'));
        }

        return response()->json($query->paginate(50)->withQueryString());
    }

    public function updateUser(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:100'],
            'email' => ['required', 'string', 'email:rfc', 'max:254', Rule::unique('users', 'email')->ignore($user->id)],
            'is_active' => ['required', 'boolean'],
            'email_verified' => ['sometimes', 'boolean'],
        ]);
        $email = Str::lower(trim($data['email']));
        $isConfiguredAdmin = hash_equals((string) config('newsfx.admin_email'), strtolower($user->email));
        abort_if($user->id === Auth::id() && (! $data['is_active'] || $email !== strtolower($user->email)), 422, 'Pour protéger l’accès administrateur, utilisez un autre compte pour modifier votre adresse ou suspendre ce compte.');
        abort_if($isConfiguredAdmin && ! $data['is_active'], 422, 'Le compte administrateur configuré ne peut pas être suspendu.');

        DB::transaction(function () use ($request, $user, $data, $email): void {
            $emailChanged = strtolower($user->email) !== $email;
            $updates = ['name' => trim($data['name']), 'email' => $email, 'is_active' => $data['is_active']];
            if ($emailChanged) {
                $updates['email_verified_at'] = null;
            } elseif (array_key_exists('email_verified', $data)) {
                $updates['email_verified_at'] = $data['email_verified'] ? ($user->email_verified_at ?? now()) : null;
            }
            $user->forceFill($updates)->save();

            if ($emailChanged || ! $data['is_active']) {
                TwoFactorChallenge::where('user_id', $user->id)->delete();
                if (config('session.driver') === 'database') {
                    DB::table(config('session.table', 'sessions'))->where('user_id', $user->id)->delete();
                }
            }
            AuditEvent::record($request, 'admin_user_updated', Auth::id());
        });

        return response()->json(['message' => 'Compte mis à jour.', 'user' => $user->only(['id', 'name', 'email', 'email_verified_at', 'is_active', 'created_at'])]);
    }

    public function sendUserPasswordReset(Request $request, User $user): JsonResponse
    {
        try {
            $status = Password::sendResetLink(['email' => $user->email]);
        } catch (\Throwable $exception) {
            Log::error('NEWS FX admin could not send a user password reset link.', ['exception' => get_class($exception)]);

            return response()->json(['message' => 'Le service e-mail est indisponible. Réessayez plus tard.'], 503);
        }
        AuditEvent::record($request, 'admin_password_reset_requested', Auth::id());

        if ($status !== Password::RESET_LINK_SENT) {
            return response()->json(['message' => 'Le lien de réinitialisation n’a pas pu être envoyé. Vérifiez le service e-mail.'], 503);
        }

        return response()->json(['message' => 'Un lien de réinitialisation a été envoyé à l’adresse du compte.']);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'target_usd' => ['required', 'integer', 'min:1', 'max:1000000000'],
            'campaign_end_at' => ['nullable', 'date'],
            'campaign_status' => ['required', 'in:preparation,open,paused,closed'],
            'standard_duration_months' => ['required', 'integer', 'min:1', 'max:60'],
            'discord_enabled' => ['required', 'boolean'],
            'discord_invite_url' => ['nullable', 'url', 'starts_with:https://', 'max:2048'],
            'telegram_enabled' => ['required', 'boolean'],
            'telegram_invite_url' => ['nullable', 'url', 'starts_with:https://', 'max:2048'],
            'announcement_enabled' => ['required', 'boolean'],
            'announcement_first_name' => ['nullable', 'string', 'max:80'],
            'announcement_last_name' => ['nullable', 'string', 'max:80'],
            'announcement_fr' => ['nullable', 'string', 'max:500'],
            'announcement_en' => ['nullable', 'string', 'max:500'],
            'announcement_es' => ['nullable', 'string', 'max:500'],
            'announcement_pt' => ['nullable', 'string', 'max:500'],
        ]);

        if ($data['announcement_enabled'] && (blank($data['announcement_first_name']) || blank($data['announcement_last_name']) || blank($data['announcement_fr']))) {
            return response()->json(['message' => 'Pour publier le message, renseignez le prénom, le nom et le commentaire français.'], 422);
        }

        if ($data['campaign_status'] === 'open' && (int) $data['standard_duration_months'] < 1) {
            return response()->json(['message' => 'Définissez la durée de l’offre standard avant d’ouvrir les paiements.'], 422);
        }

        foreach (['discord', 'telegram'] as $channel) {
            if ($data["{$channel}_enabled"] && blank($data["{$channel}_invite_url"])) {
                return response()->json(['message' => "Ajoutez un lien d’invitation HTTPS avant d’activer {$channel}."], 422);
            }

            if ($data["{$channel}_enabled"]) {
                $host = strtolower((string) parse_url((string) $data["{$channel}_invite_url"], PHP_URL_HOST));
                $allowedHosts = $channel === 'discord' ? ['discord.gg', 'discord.com'] : ['t.me', 'telegram.me'];
                if (! in_array($host, $allowedHosts, true)) {
                    return response()->json(['message' => "Le lien {$channel} doit utiliser un domaine officiel d’invitation."], 422);
                }
            }
        }

        DB::transaction(function () use ($data, $request): void {
            foreach ($data as $key => $value) {
                if (str_ends_with($key, '_enabled')) {
                    $value = $value ? '1' : '0';
                }
                SiteSetting::updateOrCreate(['key' => $key], ['value' => (string) ($value ?? '')]);
            }
            AuditEvent::record($request, 'admin_settings_updated', Auth::id());
        });

        return response()->json(['message' => 'Paramètres enregistrés.']);
    }

    public function reviewPayment(Request $request, MemberPayment $payment): JsonResponse
    {
        $data = $request->validate(['decision' => ['required', 'in:approved,rejected']]);
        DB::transaction(function () use ($payment, $data, $request): void {
            $lockedPayment = MemberPayment::whereKey($payment->id)->lockForUpdate()->firstOrFail();
            abort_unless($lockedPayment->status === 'submitted' && $lockedPayment->transaction_id, 409, 'Cette demande n’est pas encore soumise à vérification.');

            $expiresAt = null;
            if ($data['decision'] === 'approved') {
                $months = $lockedPayment->offer_key === 'founder' ? 4 : (int) $this->setting('standard_duration_months', 0);
                abort_unless($months > 0, 409, 'La durée de l’offre n’est pas définie.');
                $expiresAt = now()->addMonths($months);
            }

            $lockedPayment->update([
                'status' => $data['decision'],
                'reviewed_by' => Auth::id(),
                'reviewed_at' => now(),
                'expires_at' => $expiresAt,
            ]);
            AuditEvent::record($request, "payment_{$data['decision']}", Auth::id());
        });

        return response()->json(['message' => $data['decision'] === 'approved' ? 'Paiement validé. L’accès communautaire configuré est maintenant disponible.' : 'Paiement refusé.']);
    }

    public function geolocate(Request $request, AuditEvent $event): JsonResponse
    {
        abort_unless($event->ip_address && filter_var($event->ip_address, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE), 422, 'Adresse IP privée ou non valide.');
        $response = Http::timeout(4)->get('https://ipwho.is/'.$event->ip_address, ['fields' => 'success,country,region,city']);
        if (! $response->ok() || ! $response->json('success')) {
            return response()->json(['message' => 'La géolocalisation n’est pas disponible pour cette adresse.'], 502);
        }

        $event->update([
            'country' => $response->json('country'),
            'region' => $response->json('region'),
            'city' => $response->json('city'),
        ]);

        return response()->json(['country' => $event->country, 'region' => $event->region, 'city' => $event->city]);
    }

    private function setting(string $key, mixed $default = null): mixed
    {
        return SiteSetting::whereKey($key)->value('value') ?? $default;
    }
}
