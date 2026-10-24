<?php

return [
    'admin_email' => strtolower((string) env('NEWSFX_ADMIN_EMAIL', '')),
    'payment_address' => env('NEWSFX_USDT_TRC20_ADDRESS', 'TLKAWnKG4jXPHqxXTTuskpqk7iy25u9pgi'),
    'payment_qr' => '/payment-qr.jpeg',
    'offers' => [
        'founder' => ['name' => 'Membre fondateur', 'amount_usd' => 100, 'duration' => '4 mois'],
        'standard' => ['name' => 'Membre standard', 'amount_usd' => 1000, 'duration' => 'À définir'],
    ],
    'default_target_usd' => (int) env('NEWSFX_TARGET_USD', 100000),
];
