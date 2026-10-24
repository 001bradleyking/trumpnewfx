<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\MemberController;
use App\Http\Middleware\EnsureActiveUser;
use App\Http\Middleware\EnsureAdmin;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/auth/google', [AuthController::class, 'redirectToGoogle'])->middleware('throttle:10,1');
Route::get('/auth/google/callback', [AuthController::class, 'handleGoogleCallback'])->middleware('throttle:10,1');

Route::prefix('api')->group(function (): void {
    Route::get('/csrf', [AuthController::class, 'csrf']);
    Route::post('/auth/register', [AuthController::class, 'register'])->middleware('throttle:5,1');
    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
    Route::post('/auth/verify', [AuthController::class, 'verify'])->middleware('throttle:10,1');
    Route::post('/auth/resend-code', [AuthController::class, 'resend'])->middleware('throttle:3,1');
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:3,1');
    Route::post('/auth/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:5,1');

    Route::middleware('auth')->group(function (): void {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::middleware(EnsureActiveUser::class)->group(function (): void {
            Route::get('/member', [MemberController::class, 'show']);
            Route::post('/member/checkout', [MemberController::class, 'checkout'])->middleware('throttle:5,1');
            Route::get('/member/payments/{payment}', [MemberController::class, 'payment']);
            Route::post('/member/payments/{payment}/submit', [MemberController::class, 'submitPayment'])->middleware('throttle:5,1');
            Route::get('/member/community/{channel}', [MemberController::class, 'community'])->whereIn('channel', ['discord', 'telegram']);

            Route::prefix('admin')->middleware(EnsureAdmin::class)->group(function (): void {
                Route::get('/dashboard', [AdminController::class, 'dashboard']);
                Route::get('/users', [AdminController::class, 'users']);
                Route::patch('/users/{user}', [AdminController::class, 'updateUser']);
                Route::post('/users/{user}/reset-password', [AdminController::class, 'sendUserPasswordReset'])->middleware('throttle:3,1');
                Route::put('/settings', [AdminController::class, 'updateSettings']);
                Route::post('/payments/{payment}/review', [AdminController::class, 'reviewPayment']);
                Route::post('/events/{event}/geolocate', [AdminController::class, 'geolocate']);
            });
        });
    });
});
