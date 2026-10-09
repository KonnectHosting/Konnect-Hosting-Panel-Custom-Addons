<?php

namespace Pterodactyl\Http\Requests\Api\Client;

use Pterodactyl\Models\ServerOrder;

class UpdateServerOrderRequest extends ClientApiRequest
{
    /**
     * Determine if the current user is authorized to perform this action.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Validation rules for updating a server order.
     */
    public function rules(): array
    {
        return [
            'server_ordered' => ['nullable', 'array'],
            'server_ordered.*' => ['string'],
        ];
    }
}