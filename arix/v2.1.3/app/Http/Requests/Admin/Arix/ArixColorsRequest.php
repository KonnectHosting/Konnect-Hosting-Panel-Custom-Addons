<?php

namespace Pterodactyl\Http\Requests\Admin\Arix;

use Pterodactyl\Http\Requests\Admin\AdminFormRequest;

class ArixColorsRequest extends AdminFormRequest
{
    /**
     * @return array<int, string>
     */
    private function colorKeys(): array
    {
        return [
            'primary',
            'successText',
            'successBorder',
            'successBackground',
            'dangerText',
            'dangerBorder',
            'dangerBackground',
            'secondaryText',
            'secondaryBorder',
            'secondaryBackground',
            'gray50',
            'gray100',
            'gray200',
            'gray300',
            'gray400',
            'gray500',
            'gray600',
            'gray700',
            'gray800',
            'gray900',
        ];
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\Rule|array|string>
     */
    public function rules(): array
    {
        $rules = [
            'dark' => ['required', 'array'],
            'light' => ['required', 'array'],
        ];

        foreach (['dark', 'light'] as $mode) {
            foreach ($this->colorKeys() as $key) {
                $rules["$mode.$key"] = ['required', 'string', 'regex:/^#([a-f0-9]{6}|[a-f0-9]{3})$/i'];
            }
        }

        return $rules;
    }
}