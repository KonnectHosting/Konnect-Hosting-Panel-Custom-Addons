<?php

namespace Pterodactyl\Http\Requests\Admin\Arix;

use Pterodactyl\Http\Requests\Admin\AdminFormRequest;

class ArixLinkRequest extends AdminFormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\Rule|array|string>
     */
    public function rules(): array
    {
        return [
            'arix:links' => 'required|array',
            'arix:links.*' => 'required|array',
            'arix:links.*.name' => 'required|string',
            'arix:links.*.permission' => 'nullable|array',
            'arix:links.*.permission.*' => 'nullable|string',
            'arix:links.*.nests' => 'nullable|array',
            'arix:links.*.eggs' => 'nullable|array',
            'arix:links.*.active' => 'required|boolean',
            'arix:links.*.links' => 'required|array',
            'arix:links.*.links.*.icon' => 'nullable|string',
            'arix:links.*.links.*.name' => 'required|string',
            'arix:links.*.links.*.url' => 'required|string',
            'arix:links.*.links.*.permission' => 'nullable|array',
            'arix:links.*.links.*.permission.*' => 'nullable|string',
            'arix:links.*.links.*.nests' => 'nullable|array',
            'arix:links.*.links.*.eggs' => 'nullable|array',
            'arix:links.*.links.*.active' => 'required|boolean',
            'arix:links.*.links.*.tier' => 'nullable|array',
            'arix:links.*.links.*.tier.*' => 'string|in:budget,standard,premium',
        ];
    }
}
