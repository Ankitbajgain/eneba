<?php

namespace Tests\Feature;

use App\Models\DigitalKey;
use App\Models\Product;
use Database\Seeders\MarketplaceSeeder;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class CatalogTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MarketplaceSeeder::class);
    }

    public function test_catalog_is_paginated_sorted_and_stock_aware(): void
    {
        $response = $this->getJson('/api/v1/products?sort=price_asc&per_page=4')->assertOk()->assertJsonCount(4, 'data')->assertJsonPath('meta.total', 24);
        $prices = array_column(array_column($response->json('data'), 'min_price'), 'amount_minor');
        $sorted = $prices;
        sort($sorted);
        $this->assertSame($sorted, $prices);
        $soldOut = $this->getJson('/api/v1/products/civilization-vi')->assertOk()->assertJsonPath('data.available', false)->assertJsonPath('data.min_price', null);
        $this->getJson('/api/v1/products?available=1')->assertOk()->assertJsonPath('meta.total', 23);
    }

    public function test_filters_apply_to_the_same_offer_and_invalid_ranges_fail(): void
    {
        $this->getJson('/api/v1/products?platform=xbox&region=europe')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/products?platform=xbox&region=global&max_price=4000')->assertOk();
        $this->getJson('/api/v1/products?min_price=2000&max_price=1000')->assertUnprocessable();
        $this->getJson('/api/v1/products?per_page=500')->assertUnprocessable();
    }

    public function test_exact_partial_typo_search_and_published_scope(): void
    {
        foreach (['ELDEN RING', 'elden', 'eldn'] as $q) {
            $this->getJson('/api/v1/search?q='.urlencode($q))->assertOk()->assertJsonPath('data.0.slug', 'elden-ring');
        }
        Product::where('slug', 'elden-ring')->update(['is_published' => false]);
        $this->getJson('/api/v1/search?q=elden')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/products/elden-ring')->assertNotFound();
        $this->getJson('/api/v1/search?q=%25%25')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_offers_compare_sellers_without_exposing_keys_and_seed_is_repeatable(): void
    {
        $count = DigitalKey::count();
        $this->seed(MarketplaceSeeder::class);
        $this->assertSame($count, DigitalKey::count());
        $this->getJson('/api/v1/products/elden-ring/offers')->assertOk()->assertJsonCount(4, 'data')->assertJsonMissingPath('data.0.encrypted_value')->assertJsonMissingPath('data.0.fingerprint');
        $this->getJson('/api/v1/catalog/filters')->assertOk()->assertJsonCount(3, 'data.platforms');
    }
}
