<?php

namespace App\Services\Homepage;

use App\Http\Resources\ProductResource;
use App\Services\Catalog\CatalogService;

class DealContentService
{
    public function content($block): array
    {
        $products = app(CatalogService::class)->query(['available' => true, 'sort' => 'price_asc'])
            ->whereHas('offers', fn ($q) => $q->purchasable()->whereColumn('reference_price_minor', '>', 'price_minor'))->limit(8)->get();

        return ProductResource::collection($products)->resolve();
    }
}
