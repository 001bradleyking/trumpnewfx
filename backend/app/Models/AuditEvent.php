<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Http\Request;

class AuditEvent extends Model
{
    protected $fillable = [
        'user_id', 'event_type', 'ip_address', 'path', 'country', 'region', 'city', 'user_agent',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function record(Request $request, string $event, ?int $userId = null): void
    {
        self::create([
            'user_id' => $userId,
            'event_type' => $event,
            'ip_address' => $request->ip(),
            'path' => mb_substr($request->path(), 0, 255),
            'user_agent' => mb_substr((string) $request->userAgent(), 0, 1000),
        ]);
    }
}
