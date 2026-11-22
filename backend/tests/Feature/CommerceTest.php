<?php

namespace Tests\Feature;

use App\Models\DigitalKey;
use App\Models\Offer;
use App\Models\Order;
use App\Models\User;
use Database\Seeders\MarketplaceSeeder;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Tests\TestCase;

class CommerceTest extends TestCase
{
    use DatabaseTransactions;

    private User $buyer;

    private Offer $offer;

    protected function setUp(): void
    {
        parent::setUp();
        config(['marketplace.demo_payments' => true]);
        $this->seed(MarketplaceSeeder::class);
        $this->buyer = User::factory()->create();
        $this->offer = Offer::purchasable()->firstOrFail();
    }

    private function cart(int $quantity = 1): array
    {
        $this->actingAs($this->buyer, 'web');

        return $this->postJson('/api/v1/cart/items', ['offer_id' => $this->offer->id, 'quantity' => $quantity])->assertCreated()->json('data');
    }

    private function purchase(array $cart, string $result = 'success', ?string $key = null)
    {
        return $this->withHeader('Idempotency-Key', $key ?? (string) Str::uuid())->postJson('/api/v1/checkout', ['cart_revision' => $cart['revision'], 'simulate_result' => $result]);
    }

    public function test_success_assigns_exact_keys_clears_cart_and_only_owner_can_read(): void
    {
        $cart = $this->cart(2);
        $before = DigitalKey::where('offer_id', $this->offer->id)->whereNull('order_item_id')->count();
        $order = $this->purchase($cart)->assertCreated()->assertJsonPath('data.status', 'fulfilled')->assertJsonPath('data.total.amount_minor', 2 * $this->offer->price_minor)->assertJsonMissingPath('data.keys')->json('data');
        $this->getJson('/api/v1/orders/'.$order['id'].'/keys')->assertOk()->assertJsonCount(2, 'data')->assertHeader('Cache-Control', 'no-store, private');
        $this->assertSame($before - 2, DigitalKey::where('offer_id', $this->offer->id)->whereNull('order_item_id')->count());
        $this->getJson('/api/v1/cart')->assertJsonCount(0, 'data.items');
        Auth::forgetGuards();
        $this->actingAs(User::factory()->create(), 'web');
        $this->getJson('/api/v1/orders/'.$order['id'])->assertNotFound();
        $this->getJson('/api/v1/orders/'.$order['id'].'/keys')->assertNotFound();
    }

    public function test_idempotent_replay_cannot_duplicate_purchase_or_change_payload(): void
    {
        $cart = $this->cart();
        $key = (string) Str::uuid();
        $order = $this->purchase($cart, 'success', $key)->assertCreated()->json('data.id');
        $this->purchase($cart, 'success', $key)->assertOk()->assertHeader('Idempotency-Replayed', 'true')->assertJsonPath('data.id', $order);
        $this->purchase($cart, 'decline', $key)->assertStatus(409)->assertJsonPath('code', 'idempotency_conflict');
        $this->assertSame(1, Order::where('user_id', $this->buyer->id)->count());
    }

    public function test_decline_retains_cart_and_does_not_allocate_keys(): void
    {
        $cart = $this->cart();
        $count = DigitalKey::whereNotNull('order_item_id')->count();
        $order = $this->purchase($cart, 'decline')->assertCreated()->assertJsonPath('data.status', 'failed')->assertJsonPath('data.payment_status', 'declined')->json('data.id');
        $this->assertSame($count, DigitalKey::whereNotNull('order_item_id')->count());
        $this->getJson('/api/v1/cart')->assertJsonCount(1, 'data.items');
        $this->getJson('/api/v1/orders/'.$order.'/keys')->assertStatus(409);
    }

    public function test_stale_cart_and_price_changes_do_not_create_orders(): void
    {
        $cart = $this->cart();
        $this->postJson('/api/v1/cart/items', ['offer_id' => $this->offer->id, 'quantity' => 1])->assertCreated();
        $this->purchase($cart)->assertStatus(409)->assertJsonPath('code', 'cart_changed');
        $cart = $this->getJson('/api/v1/cart')->json('data');
        $this->offer->increment('price_minor');
        $this->purchase($cart)->assertStatus(409)->assertJsonPath('code', 'price_changed');
        $this->assertSame(0, Order::where('user_id', $this->buyer->id)->count());
        $cart = $this->patchJson('/api/v1/cart/items/'.$cart['items'][0]['id'], ['quantity' => 1])->assertOk()->json('data');
        $this->purchase($cart)->assertCreated();
    }

    public function test_insufficient_stock_rolls_back_all_lines(): void
    {
        $cart = $this->cart();
        $other = Offer::purchasable()->where('id', '!=', $this->offer->id)->firstOrFail();
        $cart = $this->postJson('/api/v1/cart/items', ['offer_id' => $other->id, 'quantity' => 1])->assertCreated()->json('data');
        $this->offer->keys()->delete();
        $this->purchase($cart)->assertStatus(409)->assertJsonPath('code', 'out_of_stock');
        $this->assertSame(0, Order::where('user_id', $this->buyer->id)->count());
        $this->assertSame(0, DigitalKey::where('offer_id', $other->id)->whereNotNull('order_item_id')->count());
        $this->getJson('/api/v1/cart')->assertJsonCount(2, 'data.items');
    }

    public function test_cart_item_ownership_and_quantity_limits(): void
    {
        $cart = $this->cart();
        Auth::forgetGuards();
        $this->actingAs(User::factory()->create(), 'web');
        $this->patchJson('/api/v1/cart/items/'.$cart['items'][0]['id'], ['quantity' => 1])->assertNotFound();
        $this->deleteJson('/api/v1/cart/items/'.$cart['items'][0]['id'])->assertNotFound();
        $this->postJson('/api/v1/cart/items', ['offer_id' => $this->offer->id, 'quantity' => 11])->assertUnprocessable();
    }

    public function test_guest_preview_is_server_priced_and_guest_checkout_is_rejected(): void
    {
        $this->postJson('/api/v1/cart/preview', ['items' => [['offer_id' => $this->offer->id, 'quantity' => 2, 'price_minor' => 1]]])->assertOk()->assertJsonPath('data.total.amount_minor', 2 * $this->offer->price_minor);
        $this->postJson('/api/v1/checkout', ['cart_revision' => 1, 'simulate_result' => 'success'])->assertUnauthorized();
    }

    public function test_demo_switch_and_missing_idempotency_key_are_enforced(): void
    {
        $cart = $this->cart();
        $this->postJson('/api/v1/checkout', ['cart_revision' => $cart['revision'], 'simulate_result' => 'success'])->assertUnprocessable();
        config(['marketplace.demo_payments' => false]);
        $this->purchase($cart)->assertStatus(503)->assertJsonPath('code', 'demo_disabled');
    }

    public function test_private_api_returns_json_401_without_an_accept_header(): void
    {
        $this->get('/api/v1/orders')->assertUnauthorized()->assertJsonPath('code', 'unauthenticated');
    }
}
