<?php

namespace App\Http\Requests\Api\V1;

use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreEventTicketRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('student_number'))) {
            $this->merge(['student_number' => trim($this->input('student_number'))]);
        }
    }

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
            'student_number' => ['required', 'string', 'max:32'],
            'event_gate_id' => ['required', 'integer', 'min:1', 'exists:event_gates,id'],
        ];
    }
}
