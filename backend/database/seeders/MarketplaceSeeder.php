<?php

namespace Database\Seeders;

use App\Models\DigitalKey;
use App\Models\Offer;
use App\Models\Platform;
use App\Models\Product;
use App\Models\Region;
use App\Models\Seller;
use App\Services\Search\SearchService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class MarketplaceSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function (): void {
            $platforms = [];
            foreach (['steam' => 'Steam', 'xbox' => 'Xbox Live', 'playstation' => 'PlayStation Network'] as $code => $name) {
                $platforms[$code] = Platform::updateOrCreate(['code' => $code], ['name' => $name]);
            }
            $global = Region::updateOrCreate(['code' => 'global'], ['name' => 'Global', 'activation_note' => 'Demo worldwide activation. Verify platform and regional requirements before choosing an offer.']);
            $europe = Region::updateOrCreate(['code' => 'europe'], ['name' => 'Europe', 'activation_note' => 'Demo key restricted to European accounts.']);
            $sellers = [];
            foreach (['digital-vault' => ['Digital Vault', 498], 'game-harbor' => ['Game Harbor', 487], 'pixel-market' => ['Pixel Market', 479]] as $slug => [$name, $rating]) {
                $sellers[] = Seller::updateOrCreate(['slug' => $slug], ['name' => $name, 'rating_hundredths' => $rating]);
            }
            $entries = json_decode(file_get_contents(database_path('seeders/data/catalog.json')), true, flags: JSON_THROW_ON_ERROR);
            foreach ($entries as $i => $entry) {
                $product = Product::updateOrCreate(['slug' => $entry['slug']], [
                    'title' => $entry['title'], 'description' => $entry['description'], 'cover_url' => '/images/games/'.$entry['slug'].'.jpg',
                    'release_date' => $entry['release_date'], 'is_published' => true,
                ]);
                app(SearchService::class)->index($product);
                foreach ($sellers as $j => $seller) {
                    $offer = Offer::updateOrCreate(['product_id' => $product->id, 'seller_id' => $seller->id, 'platform_id' => $platforms['steam']->id, 'region_id' => ($j === 2 ? $europe : $global)->id], [
                        'price_minor' => $entry['price_minor'] + $j * 149, 'reference_price_minor' => $entry['reference_price_minor'] + $j * 149, 'currency' => 'EUR', 'is_active' => true,
                    ]);
                    // Deterministic fake inventory: rerunning never replenishes sold keys.
                    for ($n = 1; $n <= ($i === 23 ? 0 : 12); $n++) {
                        $value = 'DEMO-'.strtoupper($entry['slug']).'-'.$seller->slug.'-'.str_pad((string) $n, 4, '0', STR_PAD_LEFT);
                        DigitalKey::firstOrCreate(['fingerprint' => hash_hmac('sha256', $value, config('marketplace.key_fingerprint_secret'))], ['offer_id' => $offer->id, 'encrypted_value' => $value]);
                    }
                }
                if ($i % 3 === 0) {
                    $offer = Offer::updateOrCreate(['product_id' => $product->id, 'seller_id' => $sellers[0]->id, 'platform_id' => $platforms['xbox']->id, 'region_id' => $global->id], ['price_minor' => $entry['price_minor'] + 300, 'reference_price_minor' => $entry['reference_price_minor'] + 300, 'currency' => 'EUR', 'is_active' => true]);
                    for ($n = 1; $n <= 8; $n++) {
                        $value = 'DEMO-XBOX-'.$entry['slug'].'-'.$n;
                        DigitalKey::firstOrCreate(['fingerprint' => hash_hmac('sha256', $value, config('marketplace.key_fingerprint_secret'))], ['offer_id' => $offer->id, 'encrypted_value' => $value]);
                    }
                }
            }
        });
    }
}
