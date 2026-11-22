<?php

use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

// CLI-only cleanup for the single randomly named account made by check-auth.ps1.
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$email = getenv('AUTH_SMOKE_EMAIL');
if (! is_string($email) || ! preg_match('/\Aauth-smoke-[a-f0-9]{32}@example\.test\z/', $email)) {
    fwrite(STDERR, "Refusing cleanup: invalid smoke account identifier.\n");
    exit(1);
}
DB::transaction(function () use ($email): void {
    $user = User::where('email', $email)->first();
    if ($user) {
        $orders = DB::table('orders')->where('user_id', $user->id)->pluck('id');
        $items = DB::table('order_items')->whereIn('order_id', $orders)->pluck('id');
        DB::table('digital_keys')->whereIn('order_item_id', $items)->update(['order_item_id' => null, 'sold_at' => null]);
        DB::table('payments')->whereIn('order_id', $orders)->delete();
        DB::table('order_items')->whereIn('id', $items)->delete();
        DB::table('orders')->whereIn('id', $orders)->delete();
        DB::table('carts')->where('user_id', $user->id)->delete();
        DB::table('sessions')->where('user_id', $user->id)->delete();
        $user->delete();
    }
});
