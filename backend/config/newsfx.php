<?php

return [
    // Public progress stays at zero until verified payment data is connected.
    'raised_usd' => env('NEWSFX_RAISED_USD', 0),
    'founders_count' => env('NEWSFX_FOUNDERS_COUNT', 0),
    'campaign_end_at' => env('NEWSFX_CAMPAIGN_END_AT'),
];
