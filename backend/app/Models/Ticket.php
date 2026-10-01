<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['user_id', 'event_gate_id', 'totp_secret', 'status'])]
#[Hidden(['totp_secret'])]
class Ticket extends Model
{
    public const STATUS_ISSUED = 'issued';

    public const STATUS_CLAIMED = 'claimed';

    public const STATUS_REVOKED = 'revoked';

    protected function casts(): array
    {
        return [
            'totp_secret' => 'encrypted',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function eventGate(): BelongsTo
    {
        return $this->belongsTo(EventGate::class);
    }
}
