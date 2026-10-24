<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MemberPayment extends Model
{
    protected $fillable = [
        'user_id', 'offer_key', 'amount_usd', 'network', 'status', 'transaction_id', 'reviewed_by', 'reviewed_at', 'expires_at',
    ];

    protected function casts(): array
    {
        return ['reviewed_at' => 'datetime', 'expires_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
