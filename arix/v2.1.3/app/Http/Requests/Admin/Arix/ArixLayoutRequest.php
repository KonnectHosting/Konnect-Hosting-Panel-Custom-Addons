<?php

namespace Pterodactyl\Http\Requests\Admin\Arix;

use Pterodactyl\Http\Requests\Admin\AdminFormRequest;

class ArixLayoutRequest extends AdminFormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\Rule|array|string>
     */
    public function rules(): array
    {
        return [
            'layout' => 'required|string',
            'dock' => 'required|string',
            'hoverEffect' => 'required|string',
            'searchComponent' => 'required|string',

            'logoPosition' => 'required|string',
            'socialPosition' => 'required|string',
            'loginLayout' => 'required|string',
        ];
    }
}