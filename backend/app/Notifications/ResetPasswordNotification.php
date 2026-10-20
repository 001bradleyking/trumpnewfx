<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ResetPasswordNotification extends Notification
{
    use Queueable;

    public function __construct(private readonly string $token) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = rtrim(config('app.frontend_url'), '/').'/reset-password?token='.$this->token.'&email='.urlencode($notifiable->getEmailForPasswordReset());

        return (new MailMessage)
            ->subject('Réinitialisation de votre mot de passe NEWS FX')
            ->greeting('Bonjour,')
            ->line('Vous avez demandé la réinitialisation du mot de passe de votre compte NEWS FX.')
            ->action('Choisir un nouveau mot de passe', $url)
            ->line('Ce lien expirera conformément aux paramètres de sécurité du site. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.');
    }
}
