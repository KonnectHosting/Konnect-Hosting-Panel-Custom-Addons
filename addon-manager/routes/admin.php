<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use AddonManager\Laravel\AdminController;
use AddonManager\Laravel\ApiEnvelope;
use Pterodactyl\Http\Middleware\AdminAuthenticate;
use Pterodactyl\Http\Middleware\RequireTwoFactorAuthentication;

Route::middleware([ApiEnvelope::class, 'web', 'auth.session', RequireTwoFactorAuthentication::class, AdminAuthenticate::class])
    ->prefix('admin/addon-manager')
    ->name('admin.addon-manager.')
    ->group(function (): void {
        Route::get('/', [AdminController::class, 'index'])->name('index');
        Route::get('/api/addons', [AdminController::class, 'listing'])->name('api.addons');
        Route::post('/api/operations', [AdminController::class, 'enqueue'])->name('api.operations.enqueue');
        Route::get('/api/operations/{id}', [AdminController::class, 'operation'])->name('api.operations.show');
        Route::get('/api/doctor', [AdminController::class, 'doctor'])->name('api.doctor');
    });
