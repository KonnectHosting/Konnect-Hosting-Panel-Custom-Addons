<?php

namespace Pterodactyl\Services\Servers\Files;

use Carbon\Carbon;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\Trashbin;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;
use Pterodactyl\Exceptions\Http\Connection\DaemonConnectionException;

class TrashbinService
{
    public const TRASHBIN_ROOT = '/.trashbin';

    private const PREFIX_LENGTH = 5;

    public function __construct(private DaemonFileRepository $fileRepository)
    {
    }

    public function list(Server $server): array
    {
        $entries = $this->getTrashbinDirectory($server, false);
        $metadata = Trashbin::query()
            ->where('server_id', $server->id)
            ->get()
            ->keyBy('trash_name');

        return array_values(array_map(function (array $item) use ($metadata) {
            $trashName = (string) Arr::get($item, 'name', '');
            $record = $metadata->get($trashName);

            return $this->mapDirectoryItem($item, $record);
        }, $entries));
    }

    public function move(Server $server, ?string $root, array $files): void
    {
        $normalizedRoot = $this->normalizeRoot($root);
        $sourceEntries = $this->toNameMap($this->fileRepository->setServer($server)->getDirectory($normalizedRoot));
        $trashEntries = $this->getTrashbinDirectory($server, true);
        $existingNames = array_fill_keys(array_map(fn (array $item) => (string) Arr::get($item, 'name'), $trashEntries), true);

        foreach ($files as $file) {
            $originalName = basename((string) $file);
            $trashName = $this->generateUniqueTrashName($existingNames, $originalName);

            $this->fileRepository->setServer($server)->renameFiles('/', [
                [
                    'from' => $this->toAbsolutePath($normalizedRoot, $originalName),
                    'to' => $this->toAbsolutePath(self::TRASHBIN_ROOT, $trashName),
                ],
            ]);

            $sourceMetadata = $sourceEntries->get($originalName, []);
            Trashbin::query()->updateOrCreate(
                [
                    'server_id' => $server->id,
                    'trash_name' => $trashName,
                ],
                [
                    'trash_root' => self::TRASHBIN_ROOT,
                    'original_root' => $normalizedRoot,
                    'original_name' => $originalName,
                    'is_directory' => !Arr::get($sourceMetadata, 'file', true),
                ]
            );
        }
    }

    public function restore(Server $server, array $files): void
    {
        $trashNames = array_values(array_filter(array_map(fn ($file) => basename((string) $file), $files)));

        $records = Trashbin::query()
            ->where('server_id', $server->id)
            ->whereIn('trash_name', $trashNames)
            ->get()
            ->keyBy('trash_name');

        foreach ($trashNames as $trashName) {
            $record = $records->get($trashName);

            $restoreRoot = $record?->original_root ?? '/';
            $restoreName = $record?->original_name ?? $this->stripPrefix($trashName);

            $this->fileRepository->setServer($server)->renameFiles('/', [
                [
                    'from' => $this->toAbsolutePath(self::TRASHBIN_ROOT, $trashName),
                    'to' => $this->toAbsolutePath($restoreRoot, $restoreName),
                ],
            ]);

            Trashbin::query()
                ->where('server_id', $server->id)
                ->where('trash_name', $trashName)
                ->delete();
        }
    }

    public function delete(Server $server, array $files): void
    {
        $trashNames = array_values(array_filter(array_map(fn ($file) => basename((string) $file), $files)));

        foreach ($trashNames as $trashName) {

            $this->fileRepository->setServer($server)->deleteFiles(self::TRASHBIN_ROOT, [$trashName]);

            Trashbin::query()
                ->where('server_id', $server->id)
                ->where('trash_name', $trashName)
                ->delete();
        }
    }

    private function getTrashbinDirectory(Server $server, bool $createIfMissing): array
    {
        try {
            return $this->fileRepository->setServer($server)->getDirectory(self::TRASHBIN_ROOT);
        } catch (DaemonConnectionException $exception) {
            if (!$createIfMissing) {
                return [];
            }

            $this->fileRepository->setServer($server)->createDirectory('.trashbin', '/');

            return $this->fileRepository->setServer($server)->getDirectory(self::TRASHBIN_ROOT);
        }
    }

    /**
     * @param array<string, mixed> $item
     */
    private function mapDirectoryItem(array $item, ?Trashbin $record): array
    {
        $trashName = (string) Arr::get($item, 'name', '');

        return [
            'trash_root' => self::TRASHBIN_ROOT,
            'trash_name' => $trashName,
            'display_name' => $this->stripPrefix($trashName),
            'original_root' => $record?->original_root,
            'original_name' => $record?->original_name,
            'is_directory' => !Arr::get($item, 'file', true),
            'size' => (int) Arr::get($item, 'size', 0),
            'mimetype' => Arr::get($item, 'mime', 'application/octet-stream'),
            'created_at' => Carbon::parse((string) Arr::get($item, 'created', 'now'))->toAtomString(),
            'modified_at' => Carbon::parse((string) Arr::get($item, 'modified', 'now'))->toAtomString(),
            'has_metadata' => !is_null($record),
        ];
    }

    private function normalizeRoot(?string $root): string
    {
        $path = trim((string) ($root ?? '/'));
        if ($path === '' || $path === '/') {
            return '/';
        }

        return '/' . trim($path, '/');
    }

    private function stripPrefix(string $trashName): string
    {
        return preg_replace('/^[A-Za-z0-9]{5}-/', '', $trashName) ?? $trashName;
    }

    /**
     * @param array<string, bool> $existingNames
     */
    private function generateUniqueTrashName(array &$existingNames, string $originalName): string
    {
        do {
            $candidate = sprintf('%s-%s', Str::lower(Str::random(self::PREFIX_LENGTH)), $originalName);
        } while (isset($existingNames[$candidate]));

        $existingNames[$candidate] = true;

        return $candidate;
    }

    private function toAbsolutePath(string $root, string $name): string
    {
        if ($root === '/') {
            return ltrim($name, '/');
        }

        return trim(trim($root, '/') . '/' . ltrim($name, '/'), '/');
    }

    /**
     * @param array<int, array<string, mixed>> $entries
     */
    private function toNameMap(array $entries): Collection
    {
        return collect($entries)->keyBy(fn (array $entry) => (string) Arr::get($entry, 'name'));
    }
}
