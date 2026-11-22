<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class HealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        try {
            DB::select('SELECT 1');
        } catch (QueryException) {
            return response()->json([
                'message' => 'The service is temporarily unavailable.',
                'code' => 'service_unavailable',
            ], 503)->header('Cache-Control', 'no-store');
        }

        return response()->json(['status' => 'ok'])
            ->header('Cache-Control', 'no-store');
    }
}
