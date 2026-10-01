<?php

namespace App\Http\Resources\Api\V1;

use App\Models\Venue;
use App\Models\VenueGate;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class VenueResource extends JsonResource
{
    public static $wrap = null;

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var Venue $venue */
        $venue = $this->resource;

        return [
            'id' => $venue->getKey(),
            'name' => $venue->name,
            'location_details' => $venue->location_details,
            'gates' => $venue->gates
                ->map(static function (VenueGate $gate): array {
                    return [
                        'id' => $gate->getKey(),
                        'code' => $gate->code,
                        'name' => $gate->name,
                    ];
                })
                ->all(),
        ];
    }
}
