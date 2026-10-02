<?php

namespace App\Http\Requests\Api\V1;

use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class AdminActivityLogRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user instanceof User && $user->isAdministrator();
    }

    /** @return array<string, ValidationRule|array<mixed>|string> */
    public function rules(): array
    {
        $toRules = ['sometimes', 'date_format:Y-m-d'];

        if ($this->filled('from')) {
            $toRules[] = 'after_or_equal:from';
        }

        return [
            'type' => ['sometimes', 'in:all,account,event_change,scan,anomaly'],
            'event_id' => ['sometimes', 'integer', 'min:1', 'exists:events,id'],
            'from' => ['sometimes', 'date_format:Y-m-d'],
            'to' => $toRules,
            'limit' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ];
    }
}
