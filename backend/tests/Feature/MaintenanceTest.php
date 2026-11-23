<?php

namespace Tests\Feature;

use App\Services\Maintenance\MaintenanceService;
use Illuminate\Database\Connection;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

class MaintenanceTest extends TestCase
{
    public function test_only_fixed_post_actions_without_options_are_supported(): void
    {
        Artisan::shouldReceive('call')->never();
        $this->getJson('/api/v1/maintenance/migrate')->assertStatus(405);
        $this->postJson('/api/v1/maintenance/migrate-fresh')->assertNotFound();
        $this->postJson('/api/v1/maintenance/migrate', ['command' => 'migrate:fresh', '--seed' => true])->assertUnprocessable();
    }

    public function test_unavailable_database_returns_safe_503_before_artisan_runs(): void
    {
        Artisan::shouldReceive('call')->never();
        $connection = config('database.default');
        config(["database.connections.$connection.host" => '127.0.0.1', "database.connections.$connection.port" => 1]);
        DB::purge($connection);
        $this->postJson('/api/v1/maintenance/migrate')
            ->assertStatus(503)->assertJsonPath('code', 'maintenance_unavailable')->assertDontSee('private-database-credentials');
    }

    public function test_migrate_calls_artisan_with_force_and_no_interaction(): void
    {
        Artisan::shouldReceive('call')->once()->with('migrate', ['--force' => true, '--no-interaction' => true])->andReturn(0);
        $this->withHeaders(['Origin' => 'http://localhost:8080'])->postJson('/api/v1/maintenance/migrate')
            ->assertOk()->assertHeaderMissing('Set-Cookie')->assertJsonPath('data.commands', ['migrate'])->assertJsonPath('data.exit_code', 0)
            ->assertHeader('Cache-Control', 'no-store, private');
    }

    public function test_cache_clear_and_optimize_check_each_artisan_command(): void
    {
        foreach (['cache:clear', 'config:clear', 'route:clear', 'view:clear', 'event:clear', 'clear-compiled', 'config:cache', 'event:cache', 'route:cache', 'view:cache'] as $command) {
            Artisan::shouldReceive('call')->once()->with($command, ['--no-interaction' => true])->andReturn(0);
        }
        $this->postJson('/api/v1/maintenance/cache-clear')->assertOk();
        $this->postJson('/api/v1/maintenance/optimize')->assertOk()->assertJsonPath('data.status', 'completed');
    }

    public function test_real_storage_link_is_idempotent_without_replacing_existing_files(): void
    {
        $directory = sys_get_temp_dir().'/maintenance-storage-'.bin2hex(random_bytes(8));
        mkdir($directory.'/target', 0700, true);
        config(['filesystems.links' => [$directory.'/link' => $directory.'/target']]);
        try {
            $this->postJson('/api/v1/maintenance/storage-link')->assertOk();
            $this->postJson('/api/v1/maintenance/storage-link')->assertOk();
            $this->assertSame(realpath($directory.'/target'), realpath($directory.'/link'));
            unlink($directory.'/link');
            file_put_contents($directory.'/link', 'keep');
            $this->postJson('/api/v1/maintenance/storage-link')->assertStatus(500);
            $this->assertSame('keep', file_get_contents($directory.'/link'));
        } finally {
            if (is_link($directory.'/link') || is_file($directory.'/link')) {
                unlink($directory.'/link');
            }
            rmdir($directory.'/target');
            rmdir($directory);
        }
    }

    public function test_nonzero_command_and_exception_fail_safely_and_release_lock(): void
    {
        Artisan::shouldReceive('call')->once()->with('cache:clear', ['--no-interaction' => true])->andReturn(1);
        Artisan::shouldReceive('call')->with('config:clear', ['--no-interaction' => true])->never();
        $this->postJson('/api/v1/maintenance/cache-clear')->assertStatus(500)->assertJsonPath('code', 'maintenance_failed');
        Artisan::shouldReceive('call')->once()->with('migrate', ['--force' => true, '--no-interaction' => true])->andThrow(new RuntimeException('database-password-and-private-path'));
        $this->postJson('/api/v1/maintenance/migrate')
            ->assertStatus(500)->assertDontSee('database-password-and-private-path');
        $peer = $this->peer();
        try {
            $this->assertTrue($peer->selectOne('SELECT pg_try_advisory_lock('.MaintenanceService::LOCK_ID.') AS acquired')->acquired);
            $peer->select('SELECT pg_advisory_unlock('.MaintenanceService::LOCK_ID.')');
        } finally {
            DB::disconnect('maintenance_peer');
        }
    }

    public function test_another_database_session_blocks_parallel_maintenance(): void
    {
        Artisan::shouldReceive('call')->never();
        $peer = $this->peer();
        $peer->select('SELECT pg_advisory_lock('.MaintenanceService::LOCK_ID.')');
        try {
            $this->postJson('/api/v1/maintenance/migrate')->assertStatus(409)->assertJsonPath('code', 'maintenance_busy');
        } finally {
            $peer->select('SELECT pg_advisory_unlock('.MaintenanceService::LOCK_ID.')');
            DB::disconnect('maintenance_peer');
        }
    }

    private function peer(): Connection
    {
        config(['database.connections.maintenance_peer' => config('database.connections.'.config('database.default'))]);

        return DB::connection('maintenance_peer');
    }
}
