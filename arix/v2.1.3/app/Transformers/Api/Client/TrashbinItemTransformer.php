<?php

namespace Pterodactyl\Transformers\Api\Client;

class TrashbinItemTransformer extends BaseClientTransformer
{
    public function transform(array $item): array
    {
        return [
            'trash_root' => $item['trash_root'],
            'trash_name' => $item['trash_name'],
            'display_name' => $item['display_name'],
            'original_root' => $item['original_root'],
            'original_name' => $item['original_name'],
            'is_directory' => $item['is_directory'],
            'is_file' => !$item['is_directory'],
            'size' => $item['size'],
            'mimetype' => $item['mimetype'],
            'created_at' => $item['created_at'],
            'modified_at' => $item['modified_at'],
            'has_metadata' => $item['has_metadata'],
        ];
    }

    public function getResourceName(): string
    {
        return 'trashbin_item';
    }
}
