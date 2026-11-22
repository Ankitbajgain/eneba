<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;

class VerifyCsrfToken extends PreventRequestForgery
{
    protected function hasValidOrigin($request)
    {
        // The SPA contract requires a token even for same-origin fetch requests.
        return false;
    }
}
