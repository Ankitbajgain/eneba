<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ForceApiJson
{
    public function handle(Request $request, Closure $next): Response
    {
        // API authentication must never attempt an HTML login-route redirect.
        $request->headers->set('Accept', 'application/json');

        return $next($request);
    }
}
