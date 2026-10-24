<?php

namespace Tests\Feature;

use App\Mail\SecurityAlertMail;
use App\Mail\TwoFactorCodeMail;
use App\Models\User;
use App\Notifications\ResetPasswordNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class AuthFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_registration_does_not_start_a_session_until_email_code_is_valid(): void
    {
        Mail::fake();

        $this->postJson('/api/auth/register', [
            'name' => 'Amélie Nomo',
            'email' => 'amelie@example.com',
            'password' => 'StrongPassword42',
            'password_confirmation' => 'StrongPassword42',
        ])->assertCreated()->assertJsonPath('requires_2fa', true);

        $user = User::where('email', 'amelie@example.com')->firstOrFail();
        $this->assertGuest();
        $this->assertDatabaseCount('two_factor_challenges', 1);

        $code = null;
        Mail::assertSent(TwoFactorCodeMail::class, function (TwoFactorCodeMail $mail) use (&$code): bool {
            $code = $mail->code;

            return $mail->purpose === 'registration';
        });

        $this->postJson('/api/auth/verify', ['code' => $code])
            ->assertOk()
            ->assertJsonPath('user.email', 'amelie@example.com');

        $this->assertAuthenticatedAs($user);
        $this->assertNotNull($user->fresh()->email_verified_at);
        $this->assertDatabaseCount('two_factor_challenges', 0);
    }

    public function test_failed_registration_email_does_not_leave_an_unusable_challenge(): void
    {
        Mail::shouldReceive('to')
            ->once()
            ->with('amelie@example.com')
            ->andThrow(new \RuntimeException('SMTP unavailable'));

        $this->postJson('/api/auth/register', [
            'name' => 'Amélie Nomo',
            'email' => 'amelie@example.com',
            'password' => 'StrongPassword42',
            'password_confirmation' => 'StrongPassword42',
        ])->assertStatus(503)
            ->assertJsonPath('message', 'Votre compte est créé, mais le code e-mail n’a pas pu être envoyé. Réessayez en vous connectant dans quelques instants.');

        $this->assertDatabaseHas('users', ['email' => 'amelie@example.com']);
        $this->assertDatabaseCount('two_factor_challenges', 0);
        $this->assertGuest();
    }

    public function test_failed_login_email_returns_a_retryable_error_without_authenticating(): void
    {
        $user = User::create(['name' => 'A. Nomo', 'email' => 'amelie@example.com', 'password' => 'StrongPassword42']);
        Mail::shouldReceive('to')
            ->once()
            ->with($user->email)
            ->andThrow(new \RuntimeException('SMTP unavailable'));

        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'StrongPassword42'])
            ->assertStatus(503)
            ->assertJsonPath('message', 'Le code e-mail n’a pas pu être envoyé. Vérifiez la configuration SMTP ou réessayez dans quelques instants.');

        $this->assertDatabaseCount('two_factor_challenges', 0);
        $this->assertGuest();
    }

    public function test_first_invalid_code_sends_one_security_alert_and_code_is_limited_to_five_attempts(): void
    {
        Mail::fake();
        $user = User::create(['name' => 'A. Nomo', 'email' => 'amelie@example.com', 'password' => 'StrongPassword42']);

        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'StrongPassword42'])->assertOk();
        $this->assertGuest();

        $this->postJson('/api/auth/verify', ['code' => '000000'])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Code incorrect. Une alerte de sécurité a été envoyée à votre adresse e-mail.');
        $this->assertNotNull($user->twoFactorChallenges()->firstOrFail()->fresh()->alerted_at);
        Mail::assertSentTimes(SecurityAlertMail::class, 1);

        $this->postJson('/api/auth/verify', ['code' => '000000'])->assertUnprocessable();
        Mail::assertSentTimes(SecurityAlertMail::class, 1);
        $this->assertSame(2, $user->twoFactorChallenges()->firstOrFail()->fresh()->attempts);

        for ($attempt = 3; $attempt <= 5; $attempt++) {
            $this->postJson('/api/auth/verify', ['code' => '000000'])->assertUnprocessable();
        }

        $this->postJson('/api/auth/verify', ['code' => '000000'])->assertUnprocessable()->assertJsonPath('message', 'Ce code a expiré. Recommencez la connexion ou demandez un nouveau code.');
        $this->assertGuest();
    }

    public function test_login_uses_a_second_email_step_before_authenticating(): void
    {
        Mail::fake();
        $user = User::create(['name' => 'Kossi Mensah', 'email' => 'kossi@example.com', 'password' => 'StrongPassword42']);

        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'StrongPassword42'])
            ->assertOk()
            ->assertJsonPath('requires_2fa', true);
        $this->assertGuest();

        $code = null;
        Mail::assertSent(TwoFactorCodeMail::class, function (TwoFactorCodeMail $mail) use (&$code): bool {
            $code = $mail->code;

            return $mail->purpose === 'login';
        });

        $this->postJson('/api/auth/verify', ['code' => $code])->assertOk();
        $this->assertAuthenticatedAs($user);
    }

    public function test_email_code_expires_after_ten_minutes(): void
    {
        Mail::fake();
        $user = User::create(['name' => 'Awa', 'email' => 'awa@example.com', 'password' => 'StrongPassword42']);
        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'StrongPassword42'])->assertOk();

        $code = null;
        Mail::assertSent(TwoFactorCodeMail::class, function (TwoFactorCodeMail $mail) use (&$code): bool {
            $code = $mail->code;

            return $mail->purpose === 'login';
        });

        $this->travel(11)->minutes();
        $this->postJson('/api/auth/verify', ['code' => $code])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Ce code a expiré. Recommencez la connexion ou demandez un nouveau code.');
        $this->assertGuest();
        $this->travelBack();
    }

    public function test_password_reset_email_is_generic_and_reset_token_changes_password(): void
    {
        Notification::fake();
        $user = User::create(['name' => 'Mina', 'email' => 'mina@example.com', 'password' => 'OldPassword42']);

        $this->postJson('/api/auth/forgot-password', ['email' => $user->email])
            ->assertOk()
            ->assertJsonPath('message', 'Si cette adresse correspond à un compte, un lien de réinitialisation lui a été envoyé.');
        Notification::assertSentTo($user, ResetPasswordNotification::class);

        $token = Password::createToken($user);
        $this->postJson('/api/auth/reset-password', [
            'email' => $user->email,
            'token' => $token,
            'password' => 'NewStrongPassword42',
            'password_confirmation' => 'NewStrongPassword42',
        ])->assertOk();

        $this->assertTrue(Hash::check('NewStrongPassword42', $user->fresh()->password));
        $this->assertFalse(Hash::check('OldPassword42', $user->fresh()->password));
    }
}
