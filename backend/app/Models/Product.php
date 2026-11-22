<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return ['is_published' => 'boolean', 'release_date' => 'date'];
    }

    public function offers(): HasMany
    {
        return $this->hasMany(Offer::class);
    }
}
