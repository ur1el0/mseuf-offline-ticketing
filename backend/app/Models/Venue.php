<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'location_details'])]
class Venue extends Model
{
    public function gates(): HasMany
    {
        return $this->hasMany(VenueGate::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(Event::class);
    }
}
