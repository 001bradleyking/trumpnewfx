<?php

use App\Models\MemberPayment;
use App\Models\SiteSetting;
use App\Models\Testimonial;
use Illuminate\Support\Facades\Route;

Route::get('/status', fn () => response()->json([
    'status' => SiteSetting::whereKey('campaign_status')->value('value') ?? 'preparation',
    'service' => 'NEWS FX',
    'api_access_confirmed' => false,
    'payments_enabled' => (SiteSetting::whereKey('campaign_status')->value('value') ?? 'preparation') === 'open',
]));

Route::get('/public/testimonials', fn () => response()->json(
    Testimonial::query()->where('is_published', true)->latest()->limit(30)->get()->map(fn (Testimonial $testimonial) => [
        'id' => $testimonial->id,
        'first_name' => $testimonial->first_name,
        'last_name' => $testimonial->last_name,
        'comments' => array_filter([
            'fr' => $testimonial->comment_fr,
            'en' => $testimonial->comment_en,
            'es' => $testimonial->comment_es,
            'pt' => $testimonial->comment_pt,
        ], fn ($comment) => is_string($comment) && $comment !== ''),
    ])
));

Route::get('/public/stats', fn () => response()->json([
    'target_usd' => (int) (SiteSetting::whereKey('target_usd')->value('value') ?? config('newsfx.default_target_usd')),
    'raised_usd' => (int) MemberPayment::where('status', 'approved')->sum('amount_usd'),
    'founders_count' => (int) MemberPayment::where('status', 'approved')->distinct('user_id')->count('user_id'),
    'campaign_end_at' => SiteSetting::whereKey('campaign_end_at')->value('value') ?: null,
    'standard_duration_months' => (int) (SiteSetting::whereKey('standard_duration_months')->value('value') ?? 0),
    'verified' => MemberPayment::where('status', 'approved')->exists(),
    'status' => SiteSetting::whereKey('campaign_status')->value('value') ?? 'preparation',
    'announcement' => (SiteSetting::whereKey('announcement_enabled')->value('value') ?? '0') === '1'
        ? [
            'first_name' => SiteSetting::whereKey('announcement_first_name')->value('value') ?? '',
            'last_name' => SiteSetting::whereKey('announcement_last_name')->value('value') ?? '',
            'comments' => array_filter([
                'fr' => SiteSetting::whereKey('announcement_fr')->value('value'),
                'en' => SiteSetting::whereKey('announcement_en')->value('value'),
                'es' => SiteSetting::whereKey('announcement_es')->value('value'),
                'pt' => SiteSetting::whereKey('announcement_pt')->value('value'),
            ], fn ($comment) => is_string($comment) && $comment !== ''),
        ]
        : null,
]));
