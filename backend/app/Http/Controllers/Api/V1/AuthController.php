<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(RegisterRequest $request): JsonResponse
    {
        if (Auth::guard('web')->check()) {
            return response()->json(['message' => 'You are already signed in.', 'code' => 'already_authenticated'], 409);
        }

        try {
            $user = User::create($request->safe()->only(['name', 'email', 'password']));
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['email' => ['This email is already registered.']]);
        }

        Auth::guard('web')->login($user);
        $request->session()->regenerate();

        return (new UserResource($user))->response()->setStatusCode(201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        if (Auth::guard('web')->check()) {
            return response()->json(['message' => 'You are already signed in.', 'code' => 'already_authenticated'], 409);
        }

        if (! Auth::guard('web')->attempt($request->validated())) {
            return response()->json(['message' => 'The email or password is incorrect.', 'code' => 'invalid_credentials'], 401);
        }

        $request->session()->regenerate();

        return (new UserResource(Auth::guard('web')->user()))->response()->setStatusCode(200);
    }

    public function me(Request $request): JsonResponse
    {
        return (new UserResource($request->user()))->response()->setStatusCode(200);
    }

    public function logout(Request $request): Response
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->noContent();
    }
}
