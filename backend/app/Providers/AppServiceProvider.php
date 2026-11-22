<?php

namespace App\Providers;

use App\Models\Product;
use App\Services\Search\SearchService;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Product::saved(function (Product $product): void {
            if ($product->wasRecentlyCreated || $product->wasChanged('title')) {
                app(SearchService::class)->index($product);
            }
        });
        // This SPA supports cookie sessions only, not personal access tokens.
        Sanctum::getAccessTokenFromRequestUsing(fn () => null);
        RateLimiter::for('registration', fn (Request $request) => Limit::perMinute(5)->by('register:'.$request->ip()));
        RateLimiter::for('login', function (Request $request): array {
            $email = is_string($request->input('email')) ? Str::lower(trim($request->input('email'))) : '';

            return [
                Limit::perMinute(20)->by('login-ip:'.$request->ip()),
                Limit::perMinute(5)->by('login-email:'.hash('sha256', $email.'|'.$request->ip())),
            ];
        });
    }
}
