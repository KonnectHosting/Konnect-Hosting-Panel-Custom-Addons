<?php

namespace Pterodactyl\Http\Requests\Api\Client\Account;

use Pterodactyl\Models\User;
use Illuminate\Support\Collection;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;

class UpdateProfileRequest extends ClientApiRequest
{
    public function authorize(): bool
    {
        // Only require the parent authorization; do not verify passwords here.
        return parent::authorize();
    }

    /**
     * Rules to apply to requests for updating or creating a user
     */
    public function rules(): array
    {
        return Collection::make(
            User::getRulesForUpdate($this->user())
        )->only([
            'username',
            'name_first',
            'name_last',
        ])->toArray();
    }
}
