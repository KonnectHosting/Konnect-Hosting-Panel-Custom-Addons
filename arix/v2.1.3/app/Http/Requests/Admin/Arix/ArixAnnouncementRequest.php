<?php

namespace Pterodactyl\Http\Requests\Admin\Arix;

use Pterodactyl\Http\Requests\Admin\AdminFormRequest;

class ArixAnnouncementRequest extends AdminFormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\Rule|array|string>
     */
    public function rules(): array
    {
        return [
            'enabled' => 'required|boolean',
            'position' => 'required|in:header,top',
            'color' => 'required|string',
            'icon' => 'required|string',
            'message' => [
                'nullable',
                'string',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if ($value !== null && preg_match('/\]\s*\(\s*(javascript|data|vbscript)\s*:/i', $value)) {
                        $fail("The {$attribute} must not contain links with dangerous URL protocols.");
                    }
                },
            ],
            'cta' => 'required|boolean',
            'ctaTitle' => 'required|string',
            'ctaLink' => [
                'required',
                'string',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if (preg_match('/^\s*(javascript|data|vbscript)\s*:/i', $value)) {
                        $fail("The {$attribute} must not use a dangerous URL protocol.");
                    }
                },
            ],
            'dismissable' => 'required|boolean',
        ];
    }
}