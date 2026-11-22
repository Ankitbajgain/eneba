<?php

namespace App\Exceptions;

use Illuminate\Http\Exceptions\HttpResponseException;

class ApiProblem extends HttpResponseException
{
    public function __construct(string $code, string $message, int $status = 409)
    {
        parent::__construct(response()->json(['code' => $code, 'message' => $message], $status)->header('Cache-Control', 'no-store, private'));
    }
}
