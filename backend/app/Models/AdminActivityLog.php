<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'actor_user_id',
    'action',
    'subject_type',
    'subject_id',
    'subject_label',
    'created_at',
])]
class AdminActivityLog extends Model
{
    public const ACTION_STUDENT_ACCOUNT_CREATED = 'student_account_created';

    public const ACTION_SECURITY_STAFF_ACCOUNT_CREATED = 'security_staff_account_created';

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'created_at' => 'immutable_datetime',
        ];
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }
}
