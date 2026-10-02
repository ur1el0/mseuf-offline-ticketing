<?php

namespace App\Http\Resources\Api\V1;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StudentAccountResource extends JsonResource
{
    public static $wrap = null;

    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var User $student */
        $student = $this->resource;

        return [
            'id' => $student->getKey(),
            'name' => $student->name,
            'email' => $student->email,
            'student_number' => $student->student_number,
            'created_at' => $student->created_at?->toIso8601String(),
        ];
    }
}
