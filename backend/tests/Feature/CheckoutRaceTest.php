<?php

namespace Tests\Feature;

use App\Models\DigitalKey;
use App\Models\Offer;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Services\Checkout\CartService;
use Database\Seeders\MarketplaceSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class CheckoutRaceTest extends TestCase
{
    public function test_two_processes_cannot_purchase_the_same_final_key(): void
    {
        // Fixtures are committed so separate PHP/MySQL connections can see them.
        // This test never truncates/refreshes databases; it cleans only its own IDs.
        $this->seed(MarketplaceSeeder::class);
        $suffix = (string) Str::uuid();
        $users = [];
        $workers = [];
        $offer = null;
        $product = null;
        $barrier = sys_get_temp_dir().'/checkout-race-'.$suffix;
        try {
            $product = Product::create(['slug' => 'race-'.$suffix, 'title' => 'Concurrent checkout fixture', 'description' => 'Isolated test', 'cover_url' => '/test.jpg', 'is_published' => true]);
            $source = Offer::purchasable()->firstOrFail();
            $offer = Offer::create(['product_id' => $product->id, 'seller_id' => $source->seller_id, 'platform_id' => $source->platform_id, 'region_id' => $source->region_id, 'price_minor' => 100, 'currency' => 'EUR', 'is_active' => true]);
            DigitalKey::create(['offer_id' => $offer->id, 'encrypted_value' => 'DEMO-RACE-'.$suffix, 'fingerprint' => hash('sha256', $suffix)]);
            foreach (range(1, 2) as $n) {
                $user = User::factory()->create();
                $users[] = $user->id;
                $cart = app(CartService::class)->mutate($user->id, fn ($cart) => app(CartService::class)->add($cart, $offer->id, 1));
                $payload = json_encode(['user_id' => $user->id, 'revision' => $cart['data']['revision'], 'barrier' => $barrier], JSON_THROW_ON_ERROR);
                $process = proc_open([PHP_BINARY, base_path('tests/race-worker.php'), $payload], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, base_path());
                $this->assertIsResource($process);
                $workers[] = ['process' => $process, 'pipes' => $pipes];
            }
            $until = microtime(true) + 20;
            while (! is_file($barrier.'-'.$users[0].'-ready') || ! is_file($barrier.'-'.$users[1].'-ready')) {
                if (microtime(true) > $until) {
                    $this->fail('Checkout workers did not reach the concurrency barrier.');
                }
                usleep(10000);
                clearstatcache();
            }
            file_put_contents($barrier.'-go', 'go');
            $results = [];
            foreach ($workers as &$worker) {
                $output = stream_get_contents($worker['pipes'][1]);
                $errors = stream_get_contents($worker['pipes'][2]);
                foreach ($worker['pipes'] as $pipe) {
                    fclose($pipe);
                }
                $this->assertSame(0, proc_close($worker['process']), $errors);
                $worker['process'] = null;
                $results[] = json_decode($output, true, flags: JSON_THROW_ON_ERROR);
            }
            unset($worker);
            $statuses = array_column($results, 'status');
            sort($statuses);
            $this->assertSame([201, 409], $statuses);
            $this->assertContains('out_of_stock', array_column($results, 'code'));
            $this->assertSame(1, Order::whereIn('user_id', $users)->count());
            $this->assertSame(1, DigitalKey::where('offer_id', $offer->id)->whereNotNull('order_item_id')->count());
        } finally {
            foreach ($workers as $worker) {
                if (is_resource($worker['process'])) {
                    proc_terminate($worker['process']);
                }
            }
            DB::transaction(function () use ($users, $offer, $product): void {
                $orders = DB::table('orders')->whereIn('user_id', $users)->pluck('id');
                if ($offer) {
                    DB::table('digital_keys')->where('offer_id', $offer->id)->delete();
                }
                DB::table('payments')->whereIn('order_id', $orders)->delete();
                DB::table('order_items')->whereIn('order_id', $orders)->delete();
                DB::table('orders')->whereIn('id', $orders)->delete();
                DB::table('carts')->whereIn('user_id', $users)->delete();
                if ($offer) {
                    $offer->delete();
                } if ($product) {
                    $product->delete();
                }
                DB::table('users')->whereIn('id', $users)->delete();
            });
            foreach (array_merge([$barrier.'-go'], array_map(fn ($id) => $barrier.'-'.$id.'-ready', $users)) as $file) {
                if (is_file($file)) {
                    unlink($file);
                }
            }
        }
    }
}
