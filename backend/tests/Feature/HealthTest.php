<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class HealthTest extends TestCase
{
    public function test_readiness_verifies_the_configured_database(): void
    {
        $this->withHeaders(['Origin' => 'http://localhost:8080', 'Referer' => 'http://localhost:8080/'])
            ->getJson('/api/v1/health')
            ->assertOk()
            ->assertExactJson(['status' => 'ok'])
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertHeaderMissing('Set-Cookie');
    }

    public function test_database_failure_returns_a_safe_unavailable_response(): void
    {
        // Use an actual refused connection rather than mocking the DB manager,
        // which Laravel also resolves while constructing its response factory.
        $connection = config('database.default');
        config([
            "database.connections.$connection.host" => '127.0.0.1',
            "database.connections.$connection.port" => 1,
            "database.connections.$connection.unix_socket" => '',
        ]);
        DB::purge($connection);

        $this->withHeaders(['Origin' => 'http://localhost:8080', 'Referer' => 'http://localhost:8080/'])
            ->getJson('/api/v1/health')
            ->assertStatus(503)
            ->assertExactJson([
                'message' => 'The service is temporarily unavailable.',
                'code' => 'service_unavailable',
            ])
            ->assertDontSee('SQLSTATE')
            ->assertHeader('Cache-Control', 'no-store, private');
    }
}
