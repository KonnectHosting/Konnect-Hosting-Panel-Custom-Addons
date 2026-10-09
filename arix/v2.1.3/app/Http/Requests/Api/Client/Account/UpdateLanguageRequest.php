<?php

namespace Pterodactyl\Http\Requests\Api\Client\Account;

use Illuminate\Validation\Rules\In;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;
use Pterodactyl\Traits\Helpers\AvailableLanguages;

class UpdateLanguageRequest extends ClientApiRequest
{
    use AvailableLanguages;

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'language' => ['required', 'string', new In(array_keys($this->getAvailableLanguages()))],
        ];
    }
}
