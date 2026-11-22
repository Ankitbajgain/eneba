<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CartController;
use App\Http\Controllers\Api\V1\CatalogController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\HomeController;
use App\Http\Controllers\Api\V1\OrderController;
use App\Http\Middleware\NoStore;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;

Route::prefix('v1')->group(function (): void {
    Route::withoutMiddleware(EnsureFrontendRequestsAreStateful::class)->group(function (): void {
        Route::get('/home', HomeController::class);
        Route::post('/cart/preview', [CartController::class, 'preview'])->middleware('throttle:60,1');
        Route::get('/products', [CatalogController::class, 'index']);
        Route::get('/products/{slug}', [CatalogController::class, 'show']);
        Route::get('/products/{slug}/offers', [CatalogController::class, 'offers']);
        Route::get('/catalog/filters', [CatalogController::class, 'filters']);
        Route::get('/search', [CatalogController::class, 'search']);
    });
    // Readiness must survive a database outage without first loading DB sessions.
    Route::get('/health', HealthController::class)
        ->withoutMiddleware(EnsureFrontendRequestsAreStateful::class);

    // Always start a session and enforce CSRF, even if Origin/Referer is absent.
    Route::prefix('auth')->middleware(['web', NoStore::class])
        ->withoutMiddleware(EnsureFrontendRequestsAreStateful::class)
        ->group(function (): void {
            Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:registration');
            Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');
            Route::middleware('auth:sanctum')->group(function (): void {
                Route::get('/me', [AuthController::class, 'me']);
                Route::post('/logout', [AuthController::class, 'logout']);
            });
        });
    Route::middleware(['web', NoStore::class, 'auth:sanctum'])->withoutMiddleware(EnsureFrontendRequestsAreStateful::class)->group(function (): void {
        Route::get('/cart', [CartController::class, 'show']);
        Route::post('/cart/items', [CartController::class, 'add']);
        Route::patch('/cart/items/{itemId}', [CartController::class, 'update'])->whereNumber('itemId');
        Route::delete('/cart/items/{itemId}', [CartController::class, 'delete'])->whereNumber('itemId');
        Route::post('/cart/merge', [CartController::class, 'merge']);
        Route::post('/checkout', [OrderController::class, 'checkout'])->middleware('throttle:20,1');
        Route::get('/orders', [OrderController::class, 'index']);
        Route::get('/orders/{orderId}', [OrderController::class, 'show'])->whereUuid('orderId');
        Route::get('/orders/{orderId}/keys', [OrderController::class, 'keys'])->whereUuid('orderId');
    });
});
