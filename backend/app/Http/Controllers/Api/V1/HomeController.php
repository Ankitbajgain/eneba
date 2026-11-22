<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Homepage\BannerContentService;
use App\Services\Homepage\BestSellerContentService;
use App\Services\Homepage\DealContentService;
use Illuminate\Support\Facades\DB;

class HomeController extends Controller
{
    public function __invoke()
    {
        $providers = ['banner' => BannerContentService::class, 'best_sellers' => BestSellerContentService::class, 'deals' => DealContentService::class];
        $blocks = DB::table('homepage_blocks')->where('is_enabled', true)
            ->where(fn ($q) => $q->whereNull('starts_at')->orWhere('starts_at', '<=', now()))
            ->where(fn ($q) => $q->whereNull('ends_at')->orWhere('ends_at', '>', now()))->orderBy('position')->orderBy('id')->get();

        return response()->json(['data' => $blocks->map(function ($block) use ($providers) {
            $status = 'ok';
            try {
                $items = app($providers[$block->type] ?? throw new \RuntimeException('Unsupported homepage block'))->content($block);
            } catch (\Throwable $e) {
                report($e);
                $items = [];
                $status = 'error';
            }

            return ['key' => $block->block_key, 'type' => $block->type, 'title' => $block->title, 'status' => $status, 'items' => $items];
        })]);
    }
}
