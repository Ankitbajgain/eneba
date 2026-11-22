<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $available = $this->offers->filter(fn ($offer) => $offer->available_keys_count > 0)->sortBy('price_minor')->first();

        return [
            'id' => $this->id, 'slug' => $this->slug, 'title' => $this->title, 'cover_url' => $this->cover_url,
            'description' => $this->description, 'release_date' => $this->release_date?->format('Y-m-d'),
            'min_price' => $available ? ['amount_minor' => $available->price_minor, 'currency' => $available->currency] : null,
            'reference_price' => $available?->reference_price_minor ? ['amount_minor' => $available->reference_price_minor, 'currency' => $available->currency] : null,
            'available' => (bool) $available,
            'platforms' => $this->offers->map(fn ($o) => ['code' => $o->platform->code, 'name' => $o->platform->name])->unique('code')->values(),
            'regions' => $this->offers->map(fn ($o) => ['code' => $o->region->code, 'name' => $o->region->name])->unique('code')->values(),
        ];
    }
}
