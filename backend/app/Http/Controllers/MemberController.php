<?php

namespace App\Http\Controllers;

use App\Models\AuditEvent;
use App\Models\MemberPayment;
use App\Models\SiteSetting;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class MemberController
{
    public function show(): JsonResponse
    {
        $user = Auth::user();
        $payments = MemberPayment::where('user_id', $user->id)->latest()->get();
        $paid = $payments->contains(fn (MemberPayment $payment): bool => $payment->status === 'approved' && $payment->expires_at?->isFuture());

        return response()->json([
            'user' => ['id' => $user->id, 'name' => $user->name, 'email' => $user->email],
            'payments' => $payments->map(fn (MemberPayment $payment): array => [
                'id' => $payment->id,
                'offer' => config("newsfx.offers.{$payment->offer_key}.name"),
                'amount_usd' => $payment->amount_usd,
                'network' => $payment->network,
                'status' => $payment->status === 'approved' && ! $payment->expires_at?->isFuture() ? 'expired' : $payment->status,
                'transaction_id' => $payment->transaction_id,
                'expires_at' => $payment->expires_at,
                'created_at' => $payment->created_at,
            ]),
            'channels' => $paid ? [
                'discord' => (bool) SiteSetting::whereKey('discord_enabled')->value('value'),
                'telegram' => (bool) SiteSetting::whereKey('telegram_enabled')->value('value'),
            ] : ['discord' => false, 'telegram' => false],
        ]);
    }

    public function checkout(Request $request): JsonResponse
    {
        abort_unless(SiteSetting::whereKey('campaign_status')->value('value') === 'open', 409, 'Les paiements ne sont pas encore ouverts. Réessayez lorsque la campagne aura été activée par l’administration.');
        $data = $request->validate(['offer' => ['required', 'in:founder,standard']]);
        if ($data['offer'] === 'standard') {
            abort_unless((int) SiteSetting::whereKey('standard_duration_months')->value('value') > 0, 409, 'La durée de l’offre standard doit d’abord être définie par l’administration.');
        }
        $offer = config("newsfx.offers.{$data['offer']}");
        $user = Auth::user();
        $pending = DB::transaction(function () use ($user, $data, $offer, $request): MemberPayment {
            User::whereKey($user->id)->lockForUpdate()->firstOrFail();
            $existing = MemberPayment::where('user_id', $user->id)
                ->where('offer_key', $data['offer'])
                ->whereIn('status', ['awaiting_payment', 'submitted'])
                ->latest()
                ->first();

            if ($existing) {
                return $existing;
            }

            $payment = MemberPayment::create([
                'user_id' => $user->id,
                'offer_key' => $data['offer'],
                'amount_usd' => $offer['amount_usd'],
                'network' => 'TRC20',
                'status' => 'awaiting_payment',
            ]);
            AuditEvent::record($request, 'payment_started', $user->id);

            return $payment;
        });

        return response()->json([
            'payment' => ['id' => $pending->id, 'offer' => $offer['name'], 'amount_usd' => $pending->amount_usd, 'status' => $pending->status],
            'network' => 'USDT on TRON (TRC20)',
            'address' => config('newsfx.payment_address'),
            'qr' => config('newsfx.payment_qr'),
            'message' => 'Envoyez uniquement des USDT sur le réseau TRON (TRC20). Les transferts d’un autre réseau ou d’un autre actif peuvent être perdus. L’accès ne sera activé qu’après vérification manuelle de la transaction.',
        ], 201);
    }

    public function submitPayment(Request $request, MemberPayment $payment): JsonResponse
    {
        abort_unless($payment->user_id === Auth::id(), 404);
        abort_unless($payment->status === 'awaiting_payment', 409, 'Cette demande n’accepte plus de transaction.');
        $data = $request->validate(['transaction_id' => ['required', 'string', 'regex:/^[a-fA-F0-9]{64}$/', Rule::unique('member_payments', 'transaction_id')]]);
        $updated = MemberPayment::whereKey($payment->id)
            ->where('user_id', Auth::id())
            ->where('status', 'awaiting_payment')
            ->update(['transaction_id' => strtolower($data['transaction_id']), 'status' => 'submitted']);
        abort_unless($updated === 1, 409, 'Cette demande a déjà été transmise ou modifiée.');
        AuditEvent::record($request, 'payment_submitted', Auth::id());

        return response()->json(['message' => 'Transaction transmise. Votre accès reste en attente jusqu’à sa vérification par l’administration.']);
    }

    public function payment(MemberPayment $payment): JsonResponse
    {
        abort_unless($payment->user_id === Auth::id(), 404);
        $approved = $payment->status === 'approved' && $payment->expires_at?->isFuture();

        return response()->json([
            'payment' => ['id' => $payment->id, 'offer' => config("newsfx.offers.{$payment->offer_key}.name"), 'amount_usd' => $payment->amount_usd, 'status' => $payment->status === 'approved' && ! $payment->expires_at?->isFuture() ? 'expired' : $payment->status, 'transaction_id' => $payment->transaction_id, 'expires_at' => $payment->expires_at],
            'network' => 'USDT on TRON (TRC20)',
            'address' => config('newsfx.payment_address'),
            'qr' => config('newsfx.payment_qr'),
            'channels' => [
                'discord' => $approved && SiteSetting::whereKey('discord_enabled')->value('value') === '1',
                'telegram' => $approved && SiteSetting::whereKey('telegram_enabled')->value('value') === '1',
            ],
        ]);
    }

    public function community(string $channel): mixed
    {
        $hasApprovedPayment = MemberPayment::where('user_id', Auth::id())->where('status', 'approved')->where('expires_at', '>', now())->exists();
        abort_unless($hasApprovedPayment, 404);
        abort_unless(SiteSetting::whereKey("{$channel}_enabled")->value('value') === '1', 404);

        $url = SiteSetting::whereKey("{$channel}_invite_url")->value('value');
        abort_unless(is_string($url) && str_starts_with($url, 'https://'), 404);

        return redirect()->away($url);
    }
}
