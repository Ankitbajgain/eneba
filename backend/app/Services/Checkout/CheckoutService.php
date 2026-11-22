<?php

namespace App\Services\Checkout;

use App\Exceptions\ApiProblem;
use App\Models\Cart;
use App\Models\Offer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CheckoutService
{
    public function purchase(int $userId, array $input, string $key): array
    {
        if (! config('marketplace.demo_payments')) {
            throw new ApiProblem('demo_disabled', 'Simulated checkout is not enabled.', 503);
        }
        $hash = hash('sha256', json_encode(['cart_revision' => (int) $input['cart_revision'], 'simulate_result' => $input['simulate_result']], JSON_THROW_ON_ERROR));

        return DB::transaction(function () use ($userId, $input, $key, $hash) {
            User::whereKey($userId)->lockForUpdate()->firstOrFail();
            $existing = Order::where('user_id', $userId)->where('idempotency_key', $key)->first();
            if ($existing) {
                if (! hash_equals($existing->request_hash, $hash)) {
                    throw new ApiProblem('idempotency_conflict', 'This request key was already used for different checkout data.');
                }

                return [$existing->load(['items', 'payment']), true];
            }
            $cart = Cart::where('user_id', $userId)->lockForUpdate()->first();
            if (! $cart || ! $cart->items()->exists()) {
                throw new ApiProblem('cart_empty', 'Your cart is empty.');
            }
            if ($cart->revision != (int) $input['cart_revision']) {
                throw new ApiProblem('cart_changed', 'Your cart changed. Review it before paying.');
            }
            $lines = $cart->items()->orderBy('offer_id')->lockForUpdate()->get();
            $offers = Offer::whereIn('id', $lines->pluck('offer_id'))->orderBy('id')->lockForUpdate()->with(['product', 'seller', 'platform', 'region'])->get()->keyBy('id');
            $total = 0;
            $keys = [];
            foreach ($lines as $line) {
                $offer = $offers->get($line->offer_id);
                if (! $offer || ! $offer->is_active || ! $offer->product->is_published) {
                    throw new ApiProblem('out_of_stock', 'An offer is no longer available.');
                }
                if ($offer->price_minor != $line->observed_price_minor) {
                    throw new ApiProblem('price_changed', 'An offer price changed. Update the cart line to accept its current price.');
                }
                $stock = $offer->keys()->whereNull('order_item_id')->orderBy('id')->limit($line->quantity)->lockForUpdate()->get();
                if ($stock->count() < $line->quantity) {
                    throw new ApiProblem('out_of_stock', 'There are not enough keys for an offer in your cart.');
                }
                $keys[$offer->id] = $stock;
                $total += $offer->price_minor * $line->quantity;
            }
            $success = $input['simulate_result'] === 'success';
            $now = now();
            $order = Order::create(['public_id' => (string) Str::uuid(), 'user_id' => $userId, 'status' => $success ? 'fulfilled' : 'failed', 'currency' => 'EUR', 'total_minor' => $total, 'idempotency_key' => $key, 'request_hash' => $hash, 'fulfilled_at' => $success ? $now : null]);
            foreach ($lines as $line) {
                $offer = $offers[$line->offer_id];
                $item = OrderItem::create(['order_id' => $order->id, 'offer_id' => $offer->id, 'product_title' => $offer->product->title, 'seller_name' => $offer->seller->name, 'platform_name' => $offer->platform->name, 'region_name' => $offer->region->name, 'quantity' => $line->quantity, 'unit_price_minor' => $offer->price_minor, 'line_total_minor' => $line->quantity * $offer->price_minor, 'created_at' => $now]);
                if ($success) {
                    foreach ($keys[$offer->id] as $digitalKey) {
                        $digitalKey->update(['order_item_id' => $item->id, 'sold_at' => $now]);
                    }
                }
            }
            Payment::create(['order_id' => $order->id, 'provider' => 'simulated', 'reference' => (string) Str::uuid(), 'status' => $success ? 'succeeded' : 'declined', 'amount_minor' => $total, 'currency' => 'EUR', 'created_at' => $now]);
            if ($success) {
                $cart->items()->delete();
                $cart->increment('revision');
            }

            return [$order->load(['items', 'payment']), false];
        }, 3);
    }
}
