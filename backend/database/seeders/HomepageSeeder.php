<?php

namespace Database\Seeders;

use App\Models\Offer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class HomepageSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function (): void {
            $now = now();
            foreach ([['campaigns', 'banner', 'Discover your next adventure', 0], ['best-sellers', 'best_sellers', 'Bestselling games', 1], ['deals', 'deals', 'Deals you don’t want to miss', 2]] as [$key,$type,$title,$position]) {
                DB::table('homepage_blocks')->updateOrInsert(['block_key' => $key], ['type' => $type, 'title' => $title, 'position' => $position, 'is_enabled' => true, 'created_at' => $now, 'updated_at' => $now]);
            }
            $block = DB::table('homepage_blocks')->where('block_key', 'campaigns')->value('id');
            foreach ([['ENTER THE LANDS BETWEEN', 'Your next great adventure starts here.', '/images/hero.jpg', '/products/elden-ring', 'Explore offers'], ['LEGENDARY WORLDS. LOWER PRICES.', 'Discover your next favourite.', '/images/games/cyberpunk-2077.jpg', '/products/cyberpunk-2077', 'Discover'], ['BIG GAMES. SMALL PRICES.', 'Make your next adventure a great deal.', '/images/games/hogwarts-legacy.jpg', '/store?sort=price_asc', 'Shop deals']] as $i => [$heading,$subheading,$image,$target,$cta]) {
                DB::table('banners')->updateOrInsert(['homepage_block_id' => $block, 'position' => $i], ['heading' => $heading, 'subheading' => $subheading, 'image_url' => $image, 'target_path' => $target, 'cta_label' => $cta, 'created_at' => $now, 'updated_at' => $now]);
            }
            // Seed real fulfilled demo orders so bestseller ranking uses order data.
            // This inaccessible fixture account has an unknown random password.
            $user = User::firstOrCreate(['email' => 'bestseller-fixture@example.test'], ['name' => 'Demo sales fixture', 'password' => Str::random(64)]);
            foreach (['elden-ring', 'cyberpunk-2077', 'baldurs-gate-3', 'hogwarts-legacy', 'red-dead-redemption-2', 'god-of-war', 'helldivers-2', 'forza-horizon-5'] as $i => $slug) {
                $key = '00000000-0000-4000-8000-'.str_pad((string) ($i + 1), 12, '0', STR_PAD_LEFT);
                if (Order::where('user_id', $user->id)->where('idempotency_key', $key)->exists()) {
                    continue;
                }
                $offer = Offer::whereHas('product', fn ($q) => $q->where('slug', $slug))->with(['product', 'seller', 'platform', 'region'])->first();
                $stock = $offer->keys()->whereNull('order_item_id')->orderBy('id')->lockForUpdate()->take(3)->get();
                if ($stock->count() < 3) {
                    continue;
                }
                $order = Order::create(['public_id' => (string) Str::uuid(), 'user_id' => $user->id, 'status' => 'fulfilled', 'currency' => 'EUR', 'total_minor' => 3 * $offer->price_minor, 'idempotency_key' => $key, 'request_hash' => hash('sha256', 'demo-sales-'.$slug), 'fulfilled_at' => $now]);
                $item = OrderItem::create(['order_id' => $order->id, 'offer_id' => $offer->id, 'product_title' => $offer->product->title, 'seller_name' => $offer->seller->name, 'platform_name' => $offer->platform->name, 'region_name' => $offer->region->name, 'quantity' => 3, 'unit_price_minor' => $offer->price_minor, 'line_total_minor' => 3 * $offer->price_minor, 'created_at' => $now]);
                foreach ($stock as $digitalKey) {
                    $digitalKey->update(['order_item_id' => $item->id, 'sold_at' => $now]);
                }
                Payment::create(['order_id' => $order->id, 'reference' => (string) Str::uuid(), 'status' => 'succeeded', 'provider' => 'simulated', 'amount_minor' => $order->total_minor, 'currency' => 'EUR', 'created_at' => $now]);
            }
        });
    }
}
