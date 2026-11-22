<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

class OrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return ['id' => $this->public_id, 'status' => $this->status, 'payment_status' => $this->payment->status, 'total' => ['amount_minor' => $this->total_minor, 'currency' => $this->currency],
            'created_at' => $this->created_at->toISOString(), 'fulfilled_at' => $this->fulfilled_at ? Carbon::parse($this->fulfilled_at)->toISOString() : null,
            'items' => $this->items->map(fn ($item) => ['id' => $item->id, 'product_title' => $item->product_title, 'seller_name' => $item->seller_name, 'platform_name' => $item->platform_name, 'region_name' => $item->region_name, 'quantity' => $item->quantity, 'unit_price' => ['amount_minor' => $item->unit_price_minor, 'currency' => 'EUR'], 'line_total' => ['amount_minor' => $item->line_total_minor, 'currency' => 'EUR']])];
    }
}
