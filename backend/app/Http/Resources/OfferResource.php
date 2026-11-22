<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OfferResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'seller' => ['name' => $this->seller->name, 'rating' => $this->seller->rating_hundredths / 100],
            'platform' => ['code' => $this->platform->code, 'name' => $this->platform->name],
            'region' => ['code' => $this->region->code, 'name' => $this->region->name, 'activation_note' => $this->region->activation_note],
            'price' => ['amount_minor' => $this->price_minor, 'currency' => $this->currency],
            'reference_price' => $this->reference_price_minor ? ['amount_minor' => $this->reference_price_minor, 'currency' => $this->currency] : null,
            'available' => (bool) ($this->is_active && $this->available_keys_count > 0 && $this->product->is_published),
        ];
    }
}
