<?php

namespace App\Services\Homepage;

use Illuminate\Support\Facades\DB;

class BannerContentService
{
    public function content($block): array
    {
        return DB::table('banners')->where('homepage_block_id', $block->id)
            ->where(fn ($q) => $q->whereNull('starts_at')->orWhere('starts_at', '<=', now()))
            ->where(fn ($q) => $q->whereNull('ends_at')->orWhere('ends_at', '>', now()))->orderBy('position')->orderBy('id')
            ->get(['heading', 'subheading', 'image_url', 'target_path', 'cta_label'])->all();
    }
}
