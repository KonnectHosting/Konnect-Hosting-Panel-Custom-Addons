<?php
declare(strict_types=1);

namespace Pterodactyl\Addons\GmodToolkit;

use RuntimeException;

/** Viewing a collection never changes the server's generated Lua. */
final class WorkshopView
{
    public function __construct(private State $state, private Workshop $workshop) {}

    private function key(string $uuid, int $actor): string { return 'workshop-view-' . $uuid . '-' . $actor; }

    private function current(string $key, string $uuid): array
    {
        $saved = $this->state->read($key);
        if ($saved !== []) { return $saved; }
        // Preserve the collection visible before this feature was installed.
        $result = $this->state->read('workshop-collection-' . $uuid)['result'] ?? null;
        $saved = ['input' => $result['collection'] ?? '', 'collection' => $result, 'refreshedAt' => null];
        $this->state->write($key, $saved);
        return $saved;
    }

    public function save(string $uuid, int $actor, string $input): array
    {
        $key = $this->key($uuid, $actor);
        return $this->state->locked($key, function () use ($key, $uuid, $input) {
            $current = $this->current($key, $uuid);
            $input = trim($input);
            if ($current['input'] !== $input) {
                $current = ['input' => $input, 'collection' => null, 'refreshedAt' => null];
                $this->state->write($key, $current);
            }
            return ['input' => $input];
        });
    }

    public function status(string $uuid, int $actor): array
    {
        $key = $this->key($uuid, $actor);
        $saved = $this->state->locked($key, fn () => $this->current($key, $uuid));
        if ($saved['input'] === '') { return $saved + ['refreshError' => null]; }
        // Steam requests run outside the preference lock so typing can save a new selection.
        try {
            $result = $this->workshop->resolve($saved['input']);
            $updated = ['input' => $saved['input'], 'collection' => array_intersect_key($result,
                array_flip(['collection', 'title', 'bytes', 'knownSizes', 'items', 'collections', 'duplicates'])),
                'refreshedAt' => gmdate('c')];
            $error = null;
        } catch (RuntimeException | \JsonException $failure) {
            $updated = $saved;
            $error = $failure->getMessage();
        }
        return $this->state->locked($key, function () use ($key, $uuid, $saved, $updated, $error) {
            $current = $this->current($key, $uuid);
            if ($current['input'] !== $saved['input']) { return $current + ['refreshError' => null]; }
            if ($error !== null) { return $current + ['refreshError' => $error]; }
            $this->state->write($key, $updated);
            return $updated + ['refreshError' => $error];
        });
    }
}
