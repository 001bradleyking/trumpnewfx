<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;

class TwoFactorCodeMail extends Mailable
{
    use Queueable;

    public function __construct(public readonly string $code, public readonly string $purpose) {}

    public function envelope(): \Illuminate\Mail\Mailables\Envelope
    {
        return new \Illuminate\Mail\Mailables\Envelope(subject: 'Votre code de vérification NEWS FX');
    }

    public function content(): \Illuminate\Mail\Mailables\Content
    {
        return new \Illuminate\Mail\Mailables\Content(text: 'mail.two-factor-code');
    }
}
