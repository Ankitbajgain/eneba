<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // MySQL-specific checks and indexes are kept with the versioned schema.
        $sql = file_get_contents(database_path('schema/marketplace.sql'));
        foreach (preg_split('/;\s*(?:\n|$)/', $sql) as $statement) {
            if (trim($statement) !== '') {
                DB::unprepared($statement);
            }
        }
    }

    public function down(): void
    {
        foreach (['product_search_grams', 'banners', 'homepage_blocks', 'payments', 'digital_keys', 'order_items', 'orders', 'cart_items', 'carts', 'offers', 'regions', 'platforms', 'products', 'sellers'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
