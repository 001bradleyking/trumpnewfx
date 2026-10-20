<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TwoFactorChallenge extends Model
{
    protected $fillable = ['user_id', 'purpose', 'code_hash', 'expires_at', 'attempts', 'alerted_at'];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime', 'alerted_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
