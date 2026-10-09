<?php

namespace Pterodactyl\Http\Requests\Admin\Arix;

use Pterodactyl\Http\Requests\Admin\AdminFormRequest;

class ArixComponentsRequest extends AdminFormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\Rule|array|string>
     */
    public function rules(): array
    {
        return [
            'serverRow' => 'required|string',
            'statsCards' => 'required|integer',
            'sideGraphs' => 'required|integer',
            'graphs' => 'required|integer',

            'titledBoxStyle' => 'required|string',
            'statsStyle' => 'required|string',
            'tableStyle' => 'required|string',
        ];
    }
}