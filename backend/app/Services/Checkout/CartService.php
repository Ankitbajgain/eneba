<?php

namespace App\Services\Checkout;

use App\Exceptions\ApiProblem;
use App\Http\Resources\OfferResource;
use App\Http\Resources\ProductResource;
use App\Models\Cart;
use App\Models\Offer;
use App\Models\User;
use App\Services\Catalog\CatalogService;
use Illuminate\Support\Facades\DB;

class CartService
{
    public function cart(int $userId): Cart
    {
        return Cart::firstOrCreate(['user_id' => $userId]);
    }

    public function mutate(int $userId, callable $action): array
    {
        return DB::transaction(function () use ($userId, $action) {
            User::whereKey($userId)->lockForUpdate()->firstOrFail();
            $cart = $this->cart($userId);
            $cart = Cart::whereKey($cart->id)->lockForUpdate()->firstOrFail();
            $warnings = $action($cart) ?? [];
            $cart->increment('revision');

            return ['data' => $this->view($cart->fresh()), 'warnings' => $warnings];
        }, 3);
    }

    public function add(Cart $cart, int $offerId, int $quantity, bool $replace = false): void
    {
        $offer = Offer::purchasable()->find($offerId);
        if (! $offer) {
            throw new ApiProblem('out_of_stock', 'This offer is currently unavailable.');
        }
        $line = $cart->items()->where('offer_id', $offerId)->first();
        if (! $line && $cart->items()->count() >= 50) {
            throw new ApiProblem('cart_limit', 'The cart can contain at most 50 different offers.', 422);
        }
        $total = ($replace ? 0 : ($line?->quantity ?? 0)) + $quantity;
        if ($total > 10) {
            throw new ApiProblem('quantity_limit', 'Choose at most 10 copies of an offer.', 422);
        }
        $cart->items()->updateOrCreate(['offer_id' => $offerId], ['quantity' => $total, 'observed_price_minor' => $offer->price_minor]);
    }

    public function view(Cart $cart): array
    {
        return $this->price($cart->items()->orderBy('id')->get()->map(fn ($item) => ['id' => $item->id, 'offer_id' => $item->offer_id, 'quantity' => $item->quantity, 'observed_price_minor' => $item->observed_price_minor])->all(), $cart->revision);
    }

    public function price(array $lines, int $revision = 1, bool $public = false): array
    {
        $offers = Offer::whereIn('id', array_column($lines, 'offer_id'))->when($public, fn ($q) => $q->where('is_active', true)->whereHas('product', fn ($p) => $p->where('is_published', true)))->with(['seller', 'platform', 'region', 'product'])->withCount(['keys as available_keys_count' => fn ($q) => $q->whereNull('order_item_id')])->get()->keyBy('id');
        $products = app(CatalogService::class)->query()->whereIn('products.id', $offers->pluck('product_id'))->get()->keyBy('id');
        $total = 0;
        $items = [];
        foreach ($lines as $line) {
            $offer = $offers->get($line['offer_id']);
            if (! $offer) {
                continue;
            }
            $price = $offer->price_minor;
            $quantity = (int) $line['quantity'];
            $issue = ! $offer->is_active || ! $offer->product->is_published ? 'unavailable' : ($offer->available_keys_count < $quantity ? 'out_of_stock' : (($line['observed_price_minor'] ?? $price) != $price ? 'price_changed' : null));
            $total += $price * $quantity;
            $product = $products->get($offer->product_id);
            $items[] = ['id' => $line['id'] ?? $offer->id, 'offer' => (new OfferResource($offer))->resolve(), 'product' => $product ? (new ProductResource($product))->resolve() : ['id' => $offer->product_id, 'slug' => $offer->product->slug, 'title' => $offer->product->title, 'cover_url' => $offer->product->cover_url, 'min_price' => null, 'available' => false, 'platforms' => [], 'regions' => []],
                'quantity' => $quantity, 'observed_price' => ['amount_minor' => $line['observed_price_minor'] ?? $price, 'currency' => 'EUR'], 'valid' => $issue === null, 'issue' => $issue];
        }

        return ['revision' => $revision, 'items' => $items, 'total' => ['amount_minor' => $total, 'currency' => 'EUR']];
    }
}
