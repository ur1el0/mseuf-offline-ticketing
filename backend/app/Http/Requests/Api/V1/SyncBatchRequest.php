<?php

namespace App\Http\Requests\Api\V1;

use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class SyncBatchRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $scans = $this->input('scans');

        if (! is_array($scans)) {
            return;
        }

        foreach ($scans as $index => $scan) {
            if (is_array($scan) && is_string($scan['scan_id'] ?? null)) {
                $scans[$index]['scan_id'] = strtolower($scan['scan_id']);
            }
        }

        $this->merge(['scans' => $scans]);
    }

    public function authorize(): bool
    {
        $user = $this->user();

        return $user instanceof User && $user->isSecurityStaff();
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'device_id' => ['required', 'string', 'max:64'],
            'scans' => ['required', 'array', 'min:1', 'max:50'],
            'scans.*' => [
                'required',
                'array:scan_id,ticket_id,gate_id,scanned_at,is_override,event_configuration_version',
            ],
            'scans.*.scan_id' => ['required', 'uuid:4', 'distinct'],
            'scans.*.ticket_id' => ['required', 'integer', 'min:1', 'exists:tickets,id'],
            'scans.*.gate_id' => ['required', 'integer', 'min:1', 'exists:event_gates,id'],
            'scans.*.scanned_at' => ['required', 'integer', 'min:0', 'max:4102444800000'],
            'scans.*.is_override' => ['required', 'boolean'],
            'scans.*.event_configuration_version' => [
                'sometimes',
                'nullable',
                'integer',
                'min:1',
                'max:2147483647',
            ],
        ];
    }
}
