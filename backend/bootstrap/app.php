<?php

use App\Exceptions\ApiProblem;
use App\Http\Middleware\ForceApiJson;
use App\Http\Middleware\VerifyCsrfToken;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        if ($proxies = env('TRUSTED_PROXIES')) {
            $middleware->trustProxies(at: $proxies === '*' ? '*' : explode(',', $proxies), headers: Request::HEADER_X_FORWARDED_FOR | Request::HEADER_X_FORWARDED_PROTO);
        }
        $middleware->statefulApi();
        $middleware->api(prepend: [ForceApiJson::class]);
        $middleware->web(replace: [
            PreventRequestForgery::class => VerifyCsrfToken::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
        $exceptions->render(function (ValidationException $exception, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json(['message' => 'Please check the highlighted fields.', 'code' => 'validation_failed', 'errors' => $exception->errors()], 422);
        });
        $exceptions->render(function (AuthenticationException $exception, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['message' => 'Please sign in to continue.', 'code' => 'unauthenticated'], 401);
            }
        });
        $exceptions->render(function (HttpExceptionInterface $exception, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }
            [$code, $message] = match ($exception->getStatusCode()) {
                403 => ['forbidden', 'You cannot access this resource.'],
                404 => ['not_found', 'The requested resource was not found.'],
                419 => ['csrf_mismatch', 'Your session has expired. Please try again.'],
                429 => ['too_many_requests', 'Too many attempts. Please wait before trying again.'],
                default => ['request_failed', 'The request could not be completed.'],
            };

            return response()->json(['message' => $message, 'code' => $code], $exception->getStatusCode(), $exception->getHeaders());
        });
        $exceptions->respond(function (Response $response, Throwable $exception, Request $request): Response {
            if ($request->is('api/*')) {
                if ($response->getStatusCode() >= 500 && ! ($exception instanceof ApiProblem)) {
                    $response = response()->json(['message' => 'The service is temporarily unavailable.', 'code' => 'service_unavailable'], $response->getStatusCode());
                }
                $response->headers->set('Cache-Control', 'no-store, private');
            }

            return $response;
        });
    })->create();
