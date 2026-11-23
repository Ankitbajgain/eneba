<?php

// CLI-only bridge for preserving the local MySQL dataset during the PG switch.
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

if (PHP_SAPI !== 'cli') {
    exit(1);
}
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$path = storage_path('app/private/database-transfer.json');
$tables = ['users', 'password_reset_tokens', 'sessions', 'sellers', 'products', 'platforms', 'regions', 'offers', 'carts', 'cart_items', 'orders', 'order_items', 'digital_keys', 'payments', 'homepage_blocks', 'banners', 'product_search_grams'];
if (($argv[1] ?? '') === 'export') {
    if (is_file($path)) {
        throw new RuntimeException('Transfer snapshot already exists; preserve it separately before another export.');
    }
    $snapshot = DB::transaction(function () use ($tables) {
        $data = [];
        foreach ($tables as $table) {
            $data[$table] = DB::table($table)->get()->map(fn ($row) => (array) $row)->all();
        }

        return $data;
    });
    if (! is_dir(dirname($path))) {
        mkdir(dirname($path), 0700, true);
    }
    file_put_contents($path, json_encode($snapshot, JSON_THROW_ON_ERROR), LOCK_EX);
    chmod($path, 0600);
    echo "Private database snapshot created. No credentials or rows printed.\n";
} elseif (($argv[1] ?? '') === 'import') {
    if (DB::getDriverName() !== 'pgsql' || DB::table('users')->exists() || DB::table('products')->exists()) {
        throw new RuntimeException('Import requires an empty PostgreSQL marketplace schema.');
    }
    $data = json_decode(file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);
    if (array_keys($data) !== $tables) {
        throw new RuntimeException('Unexpected snapshot table list.');
    }
    DB::transaction(function () use ($tables, $data) {
        foreach ($tables as $table) {
            foreach (array_chunk($data[$table], 100) as $rows) {
                DB::table($table)->insert($rows);
            }
            if (Schema::hasColumn($table, 'id') && ! in_array($table, ['sessions'])) {
                $sequence = DB::selectOne('SELECT pg_get_serial_sequence(?, ?) AS name', [$table, 'id'])->name;
                if ($sequence) {
                    $max = DB::table($table)->max('id');
                    DB::select('SELECT setval(?::regclass, ?, ?)', [$sequence, $max ?? 1, $max !== null]);
                }
            }
        }
    });
    foreach ($tables as $table) {
        if (DB::table($table)->count() !== count($data[$table])) {
            throw new RuntimeException('Imported row count mismatch.');
        }
    }
    echo "PostgreSQL import verified: all snapshot table counts match.\n";
} else {
    throw new RuntimeException('Usage: php tools/transfer-database.php export|import');
}
