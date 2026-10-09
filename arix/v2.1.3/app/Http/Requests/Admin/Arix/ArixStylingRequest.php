<?php

namespace Pterodactyl\Http\Requests\Admin\Arix;

use Pterodactyl\Http\Requests\Admin\AdminFormRequest;

class ArixStylingRequest extends AdminFormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\Rule|array|string>
     */
    public function rules(): array
    {
        return [
            'pageTitle' => 'required|boolean',

            'background' => 'required|boolean',
            'backgroundImage' => 'nullable|string',
            'backgroundImageLight' => 'nullable|string',
            'loginBackground' => 'nullable|string',
            'backgroundFaded' => 'required|string',

            'backdrop' => 'required|boolean',
            'backdropPercentage' => 'required|integer',
            
            'radiusInput' => 'required|integer',
            'radiusBox' => 'required|integer',

            'borderInput' => 'required|boolean',
            'borderBox' => 'required|boolean',

            'clickEffect' => 'required|string',
            'pageTransition' => 'required|string',

            'flashMessage' => 'required|integer',

            'font' => 'required|string',
        ];
    }
}