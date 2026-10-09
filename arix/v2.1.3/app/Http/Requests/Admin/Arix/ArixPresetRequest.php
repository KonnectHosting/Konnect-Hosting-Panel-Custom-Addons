<?php

namespace Pterodactyl\Http\Requests\Admin\Arix;

use Pterodactyl\Http\Requests\Admin\AdminFormRequest;

class ArixPresetRequest extends AdminFormRequest
{
    /**
     * Dynamic validation rules for preset import.
     * Since we're accepting any preset structure, we just validate that preset is an array.
     */
    public function rules(): array
    {
        return [
            'preset' => ['required', 'array'],
        ];
    }

    public function messages(): array
    {
        return [
            'preset.required' => 'Preset is required.',
            'preset.array'   => 'Preset must be an array.',
        ];
    }
}