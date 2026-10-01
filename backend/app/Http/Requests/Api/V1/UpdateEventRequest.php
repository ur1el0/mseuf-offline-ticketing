<?php

namespace App\Http\Requests\Api\V1;

use App\Models\Event;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateEventRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user instanceof User && $user->isAdministrator();
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:150'],
            'description' => ['sometimes', 'nullable', 'string'],
            'starts_at' => ['sometimes', 'required', 'date'],
            'ends_at' => ['sometimes', 'required', 'date'],
            'status' => [
                'sometimes',
                'required',
                Rule::in([
                    Event::STATUS_DRAFT,
                    Event::STATUS_SCHEDULED,
                    Event::STATUS_IN_PROGRESS,
                    Event::STATUS_POSTPONED,
                    Event::STATUS_CANCELLED,
                    Event::STATUS_COMPLETED,
                ]),
            ],
            'reason' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ];
    }
}
