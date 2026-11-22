<?php

namespace App\Services\Homepage;

use App\Http\Resources\ProductResource;
use App\Services\Catalog\CatalogService;
use Illuminate\Support\Facades\DB;

class BestSellerContentService
{
    public function content($block): array
    {
        $ids = DB::table('order_items')->join('orders', 'orders.id', '=', 'order_items.order_id')->join('offers', 'offers.id', '=', 'order_items.offer_id')
            ->where('orders.status', 'fulfilled')->where('orders.fulfilled_at', '>=', now()->subDays(30))
            ->groupBy('offers.product_id')->orderByRaw('SUM(order_items.quantity) DESC')->orderBy('offers.product_id')->limit(8)->pluck('offers.product_id')->all();
        if (! $ids) {
            return [];
        }
        $products = app(CatalogService::class)->query()->whereIn('products.id', $ids)->get()->sortBy(fn ($p) => array_search($p->id, $ids))->values();

        return ProductResource::collection($products)->resolve();
    }
}
