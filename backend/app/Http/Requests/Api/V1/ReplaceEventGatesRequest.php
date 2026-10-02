<?php

namespace App\Http\Requests\Api\V1;

use App\Models\Event;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ReplaceEventGatesRequest extends FormRequest
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
        $event = $this->route('event');
        $venueId = $event instanceof Event ? $event->venue_id : 0;

        return [
            'gates' => ['required', 'array', 'max:50'],
            'gates.*' => ['required', 'array:venue_gate_id,capacity,security_staff_ids'],
            'gates.*.venue_gate_id' => [
                'required',
                'integer',
                'distinct',
                Rule::exists('venue_gates', 'id')->where('venue_id', $venueId),
            ],
            'gates.*.capacity' => ['nullable', 'integer', 'min:1'],
            'gates.*.security_staff_ids' => ['required', 'array', 'max:50'],
            'gates.*.security_staff_ids.*' => [
                'required',
                'integer',
                Rule::exists('users', 'id')->where('role', User::ROLE_SECURITY_STAFF),
            ],
            'reason' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ];
    }
}
