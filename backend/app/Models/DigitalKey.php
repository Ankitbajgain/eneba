<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DigitalKey extends Model
{
    protected $guarded = [];

    protected $hidden = ['encrypted_value', 'fingerprint'];

    protected function casts(): array
    {
        return ['encrypted_value' => 'encrypted'];
    }
}
