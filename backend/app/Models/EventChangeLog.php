<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'event_id',
    'actor_user_id',
    'configuration_version',
    'change_type',
    'reason',
    'old_values',
    'new_values',
])]
class EventChangeLog extends Model
{
    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'configuration_version' => 'integer',
            'old_values' => 'array',
            'new_values' => 'array',
        ];
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }
}
