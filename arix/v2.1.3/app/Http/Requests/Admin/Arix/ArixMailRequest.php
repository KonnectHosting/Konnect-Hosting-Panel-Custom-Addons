<?php

namespace Pterodactyl\Http\Requests\Admin\Arix;

use Pterodactyl\Http\Requests\Admin\AdminFormRequest;

class ArixMailRequest extends AdminFormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\Rule|array|string>
     */
    public function rules(): array
    {
        $noJs = function (string $attribute, mixed $value, \Closure $fail): void {
            if ($value !== null && $this->containsJavaScript((string) $value)) {
                $fail("The {$attribute} field must not contain JavaScript.");
            }
        };

        return [
            'editor' => ['required', 'string', 'in:simple,editor,developer'],

            'logo' => ['required', 'string'],
            'logoFull' => ['required', 'boolean'],

            'editorCode' => ['nullable', 'string', $noJs],
            'editorJson' => ['nullable', 'string'],

            'developerCode' => ['nullable', 'string', $noJs],

            'template' => ['required', 'string'],
            'color' => ['required', 'string'],

            'status' => ['nullable', 'string'],
            'billing' => ['nullable', 'string'],
            'support' => ['nullable', 'string'],
        ];
    }

    private function containsJavaScript(string $html): bool
    {
        // <script> tags (any casing, optional whitespace before >)
        if (preg_match('/<\s*script[\s\/>]/i', $html)) {
            return true;
        }

        // javascript: protocol (handles "javascript :" with spaces)
        if (preg_match('/javascript\s*:/i', $html)) {
            return true;
        }

        // Inline event handlers: onclick=, onload=, onerror=, etc.
        if (preg_match('/\bon\w+\s*=/i', $html)) {
            return true;
        }

        // <iframe> tags (common JS execution vector)
        if (preg_match('/<\s*iframe[\s\/>]/i', $html)) {
            return true;
        }

        // data: URIs can carry text/html or application/javascript payloads
        if (preg_match('/\bdata\s*:/i', $html)) {
            return true;
        }

        return false;
    }
}