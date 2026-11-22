<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Offer extends Model
{
    protected $guarded = [];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(Seller::class);
    }

    public function platform(): BelongsTo
    {
        return $this->belongsTo(Platform::class);
    }

    public function region(): BelongsTo
    {
        return $this->belongsTo(Region::class);
    }

    public function keys(): HasMany
    {
        return $this->hasMany(DigitalKey::class);
    }

    public function scopePurchasable(Builder $query): void
    {
        $query->where('is_active', true)->whereHas('product', fn ($q) => $q->where('is_published', true))
            ->whereHas('keys', fn ($q) => $q->whereNull('order_item_id'));
    }
}
