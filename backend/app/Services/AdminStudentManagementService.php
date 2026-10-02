<?php

namespace App\Services;

use App\Models\AdminActivityLog;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class AdminStudentManagementService
{
    /**
     * @param array{search?: string|null, page?: int|string, per_page?: int|string} $filters
     */
    public function index(array $filters): LengthAwarePaginator
    {
        $search = $filters['search'] ?? null;

        return User::query()
            ->where('role', User::ROLE_STUDENT)
            ->when($search !== null && $search !== '', function ($query) use ($search): void {
                $pattern = '%'.$search.'%';
                $query->where(function ($searchQuery) use ($pattern): void {
                    $searchQuery
                        ->where('student_number', 'like', $pattern)
                        ->orWhere('name', 'like', $pattern)
                        ->orWhere('email', 'like', $pattern);
                });
            })
            ->orderBy('name')
            ->orderBy('id')
            ->paginate(
                (int) ($filters['per_page'] ?? 25),
                ['id', 'name', 'email', 'student_number', 'created_at'],
                'page',
                (int) ($filters['page'] ?? 1),
            );
    }

    /** @param array{name: string, email: string, student_number: string, password: string} $data */
    public function create(array $data, User $actor): User
    {
        return DB::transaction(function () use ($data, $actor): User {
            $student = new User;
            $student->name = $data['name'];
            $student->email = $data['email'];
            $student->student_number = $data['student_number'];
            $student->role = User::ROLE_STUDENT;
            $student->password = $data['password'];
            $student->save();

            AdminActivityLog::query()->create([
                'actor_user_id' => $actor->getKey(),
                'action' => AdminActivityLog::ACTION_STUDENT_ACCOUNT_CREATED,
                'subject_type' => 'student',
                'subject_id' => $student->getKey(),
                'subject_label' => $student->student_number.' · '.$student->name,
                'created_at' => now(),
            ]);

            return $student;
        });
    }
}
