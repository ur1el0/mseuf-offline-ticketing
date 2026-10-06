<?php

use App\Http\Controllers\Api\V1\AdminActivityLogController;
use App\Http\Controllers\Api\V1\AdminEventController;
use App\Http\Controllers\Api\V1\AdminEventGateAssignmentController;
use App\Http\Controllers\Api\V1\AdminEventOptionsController;
use App\Http\Controllers\Api\V1\AdminEventTicketController;
use App\Http\Controllers\Api\V1\AdminMetricsController;
use App\Http\Controllers\Api\V1\AdminSecurityStaffController;
use App\Http\Controllers\Api\V1\AdminStudentController;
use App\Http\Controllers\Api\V1\AssignedGatesController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\GateManifestController;
use App\Http\Controllers\Api\V1\StudentTicketController;
use App\Http\Controllers\Api\V1\SyncBatchController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::post('/auth/login', [AuthController::class, 'login'])
        ->middleware('throttle:6,1');

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);
    });

    Route::get('/student/tickets', StudentTicketController::class)
        ->middleware(['auth:sanctum', 'role:student']);

    Route::get('/staff/gates', AssignedGatesController::class)
        ->middleware(['auth:sanctum', 'role:security_staff']);

    Route::get('/gates/{gateId}/manifest', GateManifestController::class)
        ->middleware(['auth:sanctum', 'role:security_staff']);

    Route::post('/sync/batch', SyncBatchController::class)
        ->middleware(['auth:sanctum', 'role:security_staff']);

    Route::middleware(['auth:sanctum', 'role:administrator'])->prefix('admin')->group(function (): void {
        Route::get('/activity-logs', AdminActivityLogController::class);
        Route::get('/students', [AdminStudentController::class, 'index']);
        Route::post('/students', [AdminStudentController::class, 'store'])
            ->middleware('throttle:10,1');
        Route::get('/security-staff', [AdminSecurityStaffController::class, 'index']);
        Route::post('/security-staff', [AdminSecurityStaffController::class, 'store'])
            ->middleware('throttle:10,1');
        Route::get('/event-options', AdminEventOptionsController::class);
        Route::get('/events', [AdminEventController::class, 'index']);
        Route::post('/events', [AdminEventController::class, 'store']);
        Route::get('/events/{event}', [AdminEventController::class, 'show'])->whereNumber('event');
        Route::patch('/events/{event}', [AdminEventController::class, 'update'])->whereNumber('event');
        Route::put('/events/{event}/gates', [AdminEventGateAssignmentController::class, 'update'])
            ->whereNumber('event');
        Route::get('/events/{event}/tickets', [AdminEventTicketController::class, 'index'])
            ->whereNumber('event');
        Route::post('/events/{event}/tickets', [AdminEventTicketController::class, 'store'])
            ->whereNumber('event')
            ->middleware('throttle:30,1');
        Route::patch('/events/{event}/tickets/{ticket}/revoke', [AdminEventTicketController::class, 'revoke'])
            ->whereNumber('event')
            ->whereNumber('ticket');
    });

    Route::get('/admin/metrics', AdminMetricsController::class)
        ->middleware(['auth:sanctum', 'role:administrator']);
});
