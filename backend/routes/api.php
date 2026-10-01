<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\GateManifestController;
use App\Http\Controllers\Api\V1\SyncBatchController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::post('/auth/login', [AuthController::class, 'login'])
        ->middleware('throttle:6,1');

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);
    });

    Route::get('/gates/{gateId}/manifest', GateManifestController::class)
        ->middleware(['auth:sanctum', 'role:security_staff']);

    Route::post('/sync/batch', SyncBatchController::class)
        ->middleware(['auth:sanctum', 'role:security_staff']);
});
