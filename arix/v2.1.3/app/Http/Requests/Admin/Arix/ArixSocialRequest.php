<?php

namespace Pterodactyl\Http\Requests\Admin\Arix;

use Pterodactyl\Http\Requests\Admin\AdminFormRequest;

class ArixSocialRequest extends AdminFormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\Rule|array|string>
     */
    public function rules(): array
    {
        return [
            'socials' => ['present', 'array'],
            'socials.*.title' => ['nullable', 'string'],
            'socials.*.description' => ['nullable', 'string'],
            'socials.*.icon' => ['nullable', 'string'],
            'socials.*.url' => ['nullable', 'string'],
            'socialButtons' => ['required', 'boolean'],
            'discordBox' => ['required', 'boolean'],
        ];
    }
}