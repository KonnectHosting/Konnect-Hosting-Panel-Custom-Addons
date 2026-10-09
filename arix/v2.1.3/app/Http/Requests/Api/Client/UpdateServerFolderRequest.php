<?php

namespace Pterodactyl\Http\Requests\Api\Client;

class UpdateServerFolderRequest extends ClientApiRequest
{
    /**
     * Determine if the current user is authorized to perform this action.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Validation rules for creating/updating a server folder.
     */
    public function rules(): array
    {
        $folderId = $this->route('id');
        $userId = $this->user()->id;

        return [
            'name' => ['required', 'string', 'max:255'],
            'color' => ['nullable', 'string', 'max:7', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'icon' => ['nullable', 'string', 'max:255'],
            'parent_id' => [
                'nullable',
                'integer',
                'exists:server_folders,id',
                function ($attribute, $value, $fail) use ($folderId, $userId) {
                    if ($value) {
                        $parent = \Pterodactyl\Models\ServerFolder::find($value);
                        if (!$parent || $parent->user_id !== $userId) {
                            $fail('The selected parent folder is invalid.');
                            return;
                        }
                        if ($folderId && $value == $folderId) {
                            $fail('A folder cannot be its own parent.');
                            return;
                        }
                        if ($folderId) {
                            $current = $parent;
                            while ($current->parent_id) {
                                if ($current->parent_id == $folderId) {
                                    $fail('This would create a circular reference.');
                                    return;
                                }
                                $current = \Pterodactyl\Models\ServerFolder::find($current->parent_id);
                                if (!$current) break;
                            }
                        }
                    }
                },
            ],
            'servers' => ['nullable', 'array'],
            'servers.*' => ['integer', 'exists:servers,id'],
        ];
    }
}