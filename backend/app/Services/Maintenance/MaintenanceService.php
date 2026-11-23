<?php

namespace App\Services\Maintenance;

use App\Exceptions\ApiProblem;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

class MaintenanceService
{
    // Session advisory locks work before migration/cache tables exist and are
    // unaffected by cache:clear. Every app instance uses the same PG database.
    public const LOCK_ID = 1773684201;

    public function run(string $action): array
    {
        $commands = match ($action) {
            'migrate' => ['migrate' => ['--force' => true, '--no-interaction' => true]],
            // Run the optimize:clear/optimize constituent commands explicitly:
            // their wrapper commands can return 0 even when a child fails.
            'cache-clear' => array_fill_keys(['cache:clear', 'config:clear', 'route:clear', 'view:clear', 'event:clear', 'clear-compiled'], ['--no-interaction' => true]),
            'optimize' => array_fill_keys(['config:cache', 'event:cache', 'route:cache', 'view:cache'], ['--no-interaction' => true]),
            'storage-link' => ['storage:link' => ['--no-interaction' => true]],
            default => throw new ApiProblem('not_found', 'The requested resource was not found.', 404),
        };

        try {
            $pdo = DB::connection()->getPdo();
            $lock = $pdo->query('SELECT pg_try_advisory_lock('.self::LOCK_ID.')')->fetchColumn();
        } catch (Throwable) {
            throw new ApiProblem('maintenance_unavailable', 'The maintenance database is unavailable.', 503);
        }
        if (! in_array($lock, [true, 1, '1', 't'], true)) {
            throw new ApiProblem('maintenance_busy', 'Another maintenance operation is running.', 409);
        }

        try {
            foreach ($commands as $command => $arguments) {
                if (Artisan::call($command, $arguments) !== 0) {
                    throw new RuntimeException('Artisan command failed.');
                }
            }
            if ($action === 'storage-link') {
                foreach (config('filesystems.links', []) as $link => $target) {
                    if (! is_link($link) || realpath($target) === false || realpath($link) !== realpath($target)) {
                        throw new RuntimeException('Storage link verification failed.');
                    }
                }
            }
            Log::notice('Maintenance operation completed.', ['action' => $action]);

            return ['action' => $action, 'status' => 'completed', 'commands' => array_keys($commands), 'exit_code' => 0];
        } catch (Throwable $exception) {
            // Artisan output/exceptions may include paths or database details.
            Log::warning('Maintenance operation failed.', ['action' => $action, 'command' => $command ?? null, 'exception_type' => $exception::class]);
            throw new ApiProblem('maintenance_failed', 'The maintenance operation failed. Check the deployment configuration.', 500);
        } finally {
            try {
                $pdo->query('SELECT pg_advisory_unlock('.self::LOCK_ID.')');
            } catch (Throwable) {
                // PostgreSQL also releases session locks on disconnect.
                Log::warning('Maintenance lock connection closed.', ['action' => $action]);
            }
        }
    }
}
