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
                '08001', '08006' => $this->connectionFailureReason($exception),
                default => $this->connectionFailureReason($exception, 'query_failed'),
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

    private function connectionFailureReason(QueryException $exception, string $fallback = 'connection_failed'): string
    {
        // libpq can report distinct startup failures under the same SQLSTATE.
        $detail = strtolower($exception->getPrevious()?->getMessage() ?? '');

        return match (true) {
            str_contains($detail, 'could not translate host name') => 'dns_lookup_failed',
            str_contains($detail, 'password authentication failed'),
            str_contains($detail, 'no password supplied') => 'authentication_failed',
            str_contains($detail, 'does not exist') && str_contains($detail, 'database') => 'database_missing',
            str_contains($detail, 'too many connections'),
            str_contains($detail, 'remaining connection slots') => 'connection_limit',
            str_contains($detail, 'ssl'), str_contains($detail, 'tls') => 'tls_failed',
            str_contains($detail, 'timeout expired'), str_contains($detail, 'timed out') => 'connection_timeout',
            str_contains($detail, 'connection refused') => 'connection_refused',
            default => $fallback,
        };
    }
}
