<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class HealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        try {
            DB::select('SELECT 1');
        } catch (QueryException $exception) {
            $reason = match ((string) $exception->getCode()) {
                '28P01', '28000' => 'authentication_failed',
                '3D000' => 'database_missing',
                '53300' => 'connection_limit',
                '57P03' => 'database_starting',
                '08001', '08006' => 'connection_failed',
                default => 'query_failed',
            };
            Log::warning('Database readiness failed.', ['reason' => $reason]);
            return response()->json([
                'message' => 'The service is temporarily unavailable.',
                'code' => 'service_unavailable',
            ], 503)->header('Cache-Control', 'no-store');
        }

        return response()->json(['status' => 'ok'])
            ->header('Cache-Control', 'no-store');
    }
}
