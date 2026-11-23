<?php

namespace App\Services\Catalog;

use App\Models\Product;
use App\Services\Search\SearchService;
use Illuminate\Database\Eloquent\Builder;

class CatalogService
{
    public function query(array $filters = []): Builder
    {
        $matching = function ($query) use ($filters) {
            $query->where('is_active', true);
            if (! empty($filters['platform'])) {
                $query->whereHas('platform', fn ($q) => $q->where('code', $filters['platform']));
            }
            if (! empty($filters['region'])) {
                $query->whereHas('region', fn ($q) => $q->where('code', $filters['region']));
            }
            if (isset($filters['min_price'])) {
                $query->where('price_minor', '>=', $filters['min_price']);
            }
            if (isset($filters['max_price'])) {
                $query->where('price_minor', '<=', $filters['max_price']);
            }
        };
        $query = Product::where('is_published', true)
            ->with(['offers' => function ($q) use ($matching) {
                $matching($q);
                $q->with(['platform', 'region'])->withCount(['keys as available_keys_count' => fn ($k) => $k->whereNull('order_item_id')]);
            }])
            ->withMin(['offers as min_price_minor' => function ($q) use ($matching) {
                $matching($q);
                $q->whereHas('keys', fn ($k) => $k->whereNull('order_item_id'));
            }], 'price_minor');
        if (array_intersect(array_keys($filters), ['platform', 'region', 'min_price', 'max_price']) || ! empty($filters['available'])) {
            $query->whereHas('offers', function ($q) use ($matching, $filters) {
                $matching($q);
                if (! empty($filters['available']) || isset($filters['min_price']) || isset($filters['max_price'])) {
                    $q->whereHas('keys', fn ($k) => $k->whereNull('order_item_id'));
                }
            });
        }
        $ids = isset($filters['q']) ? app(SearchService::class)->ids($filters['q']) : [];
        if (isset($filters['q'])) {
            $query->whereIn('products.id', $ids);
        }
        $sort = $filters['sort'] ?? (isset($filters['q']) ? 'relevance' : 'newest');
        if ($sort === 'relevance' && $ids) {
            $cases = implode(' ', array_map(fn ($rank) => 'WHEN ? THEN '.$rank, array_keys($ids)));
            $query->orderByRaw('CASE products.id '.$cases.' END', $ids);
        } elseif (in_array($sort, ['price_asc', 'price_desc'])) {
            $direction = $sort === 'price_asc' ? 'asc' : 'desc';
            if ($query->getConnection()->getDriverName() === 'pgsql') {
                $query->orderByRaw('min_price_minor '.$direction.' NULLS LAST');
            } else {
                $query->orderByRaw('min_price_minor IS NULL')->orderBy('min_price_minor', $direction);
            }
        } elseif ($sort === 'name_asc') {
            $query->orderBy('title');
        } else {
            $query->orderByDesc('created_at');
        }

        return $query->orderBy('products.id');
    }
}
