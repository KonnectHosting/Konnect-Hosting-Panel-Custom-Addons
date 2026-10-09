<?php

namespace Pterodactyl\Http\Requests\Admin\Arix;

use Illuminate\Validation\Rule;
use Pterodactyl\Http\Requests\Admin\AdminFormRequest;
use Pterodactyl\Http\ViewComposers\AddonsConfiguration;

class ArixAddonsRequest extends AdminFormRequest
{
    public function rules(): array
    {
        $addonKey = $this->route('addon');
        $definitions = AddonsConfiguration::definitions();

        abort_unless(isset($definitions[$addonKey]), 404);

        $rules = [];

        foreach ($definitions[$addonKey] as $fieldKey => $fieldDef) {
            $nullable = $fieldDef['nullable'] ?? false;

            $rules[$fieldKey] = match ($fieldDef['type']) {
                // Arrays: 'present' allows empty [], 'required' demands at least one item.
                'array'   => [$nullable ? 'present' : 'required', 'array'],
                // Maps are objects keyed by id (e.g. egg id -> array of egg ids).
                'map'     => [$nullable ? 'present' : 'required', 'array'],
                // Booleans are always required (true/false are both valid, only absence is invalid).
                'boolean' => ['required', 'boolean'],
                'number'  => [$nullable ? 'nullable' : 'required', 'integer', 'min:0'],
                'enum'    => [$nullable ? 'nullable' : 'required', Rule::in($fieldDef['options'] ?? [])],
                default   => [$nullable ? 'nullable' : 'required', 'string', 'max:255'],
            };

            if ($fieldDef['type'] === 'array') {
                $rules[$fieldKey . '.*'] = ['integer', 'min:1'];
            }

            if ($fieldDef['type'] === 'map') {
                $rules[$fieldKey . '.*'] = ['array'];
                $rules[$fieldKey . '.*.*'] = ['integer', 'min:1'];
            }
        }

        return $rules;
    }
}
