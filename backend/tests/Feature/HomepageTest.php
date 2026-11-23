<?php

namespace Tests\Feature;

use App\Services\Homepage\DealContentService;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class HomepageTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    public function test_homepage_content_is_backend_driven_and_best_sellers_use_orders(): void
    {
        $this->getJson('/api/v1/home')->assertOk()->assertJsonCount(3, 'data')->assertJsonCount(3, 'data.0.items')->assertJsonCount(8, 'data.1.items')->assertJsonCount(8, 'data.2.items');
        DB::table('banners')->where('position', 0)->update(['heading' => 'Changed without a frontend deployment']);
        $this->getJson('/api/v1/home')->assertOk()->assertJsonPath('data.0.items.0.heading', 'Changed without a frontend deployment');
        $orders = DB::table('orders')->count();
        $this->seed(DatabaseSeeder::class);
        $this->assertSame($orders, DB::table('orders')->count());
    }

    public function test_provider_failure_does_not_break_other_blocks(): void
    {
        $this->mock(DealContentService::class, fn ($mock) => $mock->shouldReceive('content')->once()->andThrow(new \RuntimeException('Fixture provider failure')));
        $this->getJson('/api/v1/home')->assertOk()->assertJsonPath('data.0.status', 'ok')->assertJsonPath('data.1.status', 'ok')->assertJsonPath('data.2.status', 'error')->assertJsonCount(0, 'data.2.items');
    }
}
