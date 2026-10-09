<?php

namespace Pterodactyl\Http\Requests\Base;

use Illuminate\Foundation\Http\FormRequest;

class LocaleRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->has('namespace')) {
            $this->merge([
                'namespace' => str_replace('/', '-', $this->input('namespace')),
            ]);
        }
    }

    public function rules(): array
    {
        return [
            'locale' => ['required', 'string', 'regex:/^([a-z]{2}(-[A-Z]{2})?)(,[a-z]{2}(-[A-Z]{2})?)*$/'],
            'namespace' => ['required', 'string', 'regex:/^[a-z,-]{1,191}$/'],
        ];
    }
}