<?php

use App\Exceptions\ApiProblem;
use App\Services\Checkout\CheckoutService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
if (! str_ends_with((string) DB::connection()->getDatabaseName(), '_test')) {
    exit(2);
}
$input = json_decode($argv[1], true, flags: JSON_THROW_ON_ERROR);
config(['marketplace.demo_payments' => true]);
file_put_contents($input['barrier'].'-'.$input['user_id'].'-ready', 'ready');
$until = microtime(true) + 20;
while (! is_file($input['barrier'].'-go')) {
    if (microtime(true) > $until) {
        exit(3);
    } usleep(10000);
    clearstatcache();
}
try {
    app(CheckoutService::class)->purchase($input['user_id'], ['cart_revision' => $input['revision'], 'simulate_result' => 'success'], (string) Str::uuid());
    echo json_encode(['status' => 201]);
} catch (ApiProblem $problem) {
    echo json_encode(['status' => $problem->getResponse()->getStatusCode(), 'code' => json_decode($problem->getResponse()->getContent(), true)['code']]);
}
