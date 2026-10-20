<?php

use Illuminate\Support\Facades\Route;

Route::get('/status', fn () => response()->json([
    'status' => 'preproduction',
    'service' => 'NEWS FX',
    'api_access_confirmed' => false,
    'payments_enabled' => false,
]));

Route::get('/public/stats', fn () => response()->json([
    'target_usd' => 100000,
    'raised_usd' => (int) config('newsfx.raised_usd', 0),
    'founders_count' => (int) config('newsfx.founders_count', 0),
    'campaign_end_at' => config('newsfx.campaign_end_at'),
    'verified' => false,
    'status' => 'preproduction',
]));
