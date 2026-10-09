<?php

declare(strict_types=1);

namespace Konnect\AddonManager\Lifecycle;

use Konnect\AddonManager\Storage\Files;
use RuntimeException;

/** Filesystem journal deliberately works independently of Laravel and the database. */
final class Activator
{
    private string $panelRoot;
    private string $stateRoot;
    private array $config;

    public function __construct(string $panelRoot, string $stateRoot, array $config)
    {
        $this->panelRoot = $panelRoot;
        $this->stateRoot = $stateRoot;
        $this->config = $config;
    }

    public function journal(string $id): array
    {
        return Files::json($this->journalPath($id));
    }

    public function save(array $journal): void
    {
        Files::writeJson($this->journalPath($journal['operationId']), $journal);
    }

    public function prepare(array $operation, array $beforeRegistry, array $afterRegistry): array
    {
        $journal = [
            'schemaVersion' => 1, 'operationId' => $operation['id'], 'status' => 'preparing',
            'createdAt' => gmdate(DATE_ATOM), 'beforeRegistry' => $beforeRegistry, 'afterRegistry' => $afterRegistry,
            'files' => [], 'database' => ['status' => 'not-started', 'compatibleRollback' => true],
            'registryCommitted' => false, 'maintenanceEntered' => false, 'stageRoot' => $operation['stageRoot'],
        ];
        $this->save($journal);
        $before = $beforeRegistry['activeInventory'];
        $after = $afterRegistry['activeInventory'];
        $paths = array_unique([...array_keys($before), ...array_keys($after)]);
        sort($paths, SORT_STRING);
        foreach ($paths as $relative) {
            if (($before[$relative] ?? null) === ($after[$relative] ?? null)) {
                continue;
            }
            $live = Files::path($this->panelRoot, $relative);
            if (Files::hash($live) !== ($before[$relative] ?? null)) {
                throw new RuntimeException("Live source drift before backup: {$relative}");
            }
            $backup = 'backups/' . $operation['id'] . '/' . $relative;
            $mode = file_exists($live) ? (fileperms($live) & 0777) : 0644;
            if (isset($before[$relative])) {
                Files::atomic(Files::path($this->stateRoot, $backup), Files::read($live), $mode);
                if (Files::hash(Files::path($this->stateRoot, $backup)) !== $before[$relative]) {
                    throw new RuntimeException("Backup verification failed: {$relative}");
                }
            }
            $journal['files'][] = [
                'path' => $relative, 'beforeSha256' => $before[$relative] ?? null,
                'afterSha256' => $after[$relative] ?? null, 'backup' => $backup, 'mode' => $mode,
                'status' => 'prepared',
                'temporary' => (dirname($relative) === '.' ? '' : dirname($relative) . '/') . '.konnect-' . $operation['id'] . '-' . substr(hash('sha256', $relative), 0, 16) . '.tmp',
                'temporaryOwned' => false,
            ];
            $this->save($journal);
            $this->checkpoint('backup:' . $relative, $operation, $journal);
        }
        $journal['status'] = 'prepared';
        $this->save($journal);
        return $journal;
    }

    public function activate(array &$journal, array $operation): void
    {
        $journal['status'] = 'activating';
        $this->save($journal);
        foreach ($journal['files'] as $index => $entry) {
            $live = Files::path($this->panelRoot, $entry['path']);
            if (Files::hash($live) !== $entry['beforeSha256']) {
                throw new RuntimeException("Live source drift during activation: {$entry['path']}");
            }
            $journal['files'][$index]['status'] = 'intended';
            $temporary = Files::path($this->panelRoot, $entry['temporary']);
            if (file_exists($temporary)) {
                throw new RuntimeException("Activation temporary destination is occupied: {$entry['temporary']}");
            }
            $journal['files'][$index]['temporaryOwned'] = true;
            $this->save($journal);
            if ($entry['afterSha256'] === null) {
                $this->checkpoint('beforeRename:' . $entry['path'], $operation, $journal);
                if (file_exists($live) && !unlink($live)) {
                    throw new RuntimeException("Cannot remove managed file: {$entry['path']}");
                }
                Files::syncDirectory(dirname($live));
            } else {
                $stage = Files::path($operation['stageRoot'], $entry['path']);
                if (Files::hash($stage) !== $entry['afterSha256']) {
                    throw new RuntimeException("Stage changed before activation: {$entry['path']}");
                }
                Files::directory(dirname($live), 0755);
                Files::atomic($live, Files::read($stage), $entry['mode'], $temporary, function () use (&$journal, $index, $entry, $operation): void {
                    $journal['files'][$index]['status'] = 'temporary-ready';
                    $this->save($journal);
                    $this->checkpoint('beforeRename:' . $entry['path'], $operation, $journal);
                });
            }
            $this->checkpoint('afterRename:' . $entry['path'], $operation, $journal);
            $journal['files'][$index]['status'] = 'applied';
            $this->save($journal);
            if (Files::hash($live) !== $entry['afterSha256']) {
                throw new RuntimeException("Activation verification failed: {$entry['path']}");
            }
            $journal['files'][$index]['status'] = 'verified';
            $this->save($journal);
        }
        $journal['status'] = 'code-activated';
        $this->save($journal);
        $this->checkpoint('codeActivated', $operation, $journal);
    }

    public function rollback(array &$journal, array $operation): void
    {
        $journal['status'] = 'rolling-back';
        $this->save($journal);
        foreach (array_reverse(array_keys($journal['files'])) as $index) {
            $entry = $journal['files'][$index];
            $live = Files::path($this->panelRoot, $entry['path']);
            $temporary = isset($entry['temporary']) ? Files::path($this->panelRoot, $entry['temporary']) : null;
            if (($entry['temporaryOwned'] ?? false) && $temporary !== null && file_exists($temporary)) {
                if (!is_file($temporary) || !unlink($temporary)) {
                    throw new RuntimeException("Cannot clean journal-owned temporary file: {$entry['temporary']}");
                }
                Files::syncDirectory(dirname($temporary));
            }
            $hash = Files::hash($live);
            if ($hash !== $entry['beforeSha256'] && $hash !== $entry['afterSha256']) {
                throw new RuntimeException("Recovery blocked by unexpected source at {$entry['path']}; maintenance must remain enabled.");
            }
            if ($hash !== $entry['beforeSha256']) {
                if ($entry['beforeSha256'] === null) {
                    if (file_exists($live) && !unlink($live)) {
                        throw new RuntimeException("Cannot remove new file during recovery: {$entry['path']}");
                    }
                    Files::syncDirectory(dirname($live));
                } else {
                    $backup = Files::path($this->stateRoot, $entry['backup']);
                    if (Files::hash($backup) !== $entry['beforeSha256']) {
                        throw new RuntimeException("Recovery backup is missing or altered: {$entry['path']}");
                    }
                    if ($temporary !== null) {
                        $journal['files'][$index]['temporaryOwned'] = true;
                        $this->save($journal);
                    }
                    Files::atomic($live, Files::read($backup), $entry['mode'], $temporary);
                }
            }
            if (Files::hash($live) !== $entry['beforeSha256']) {
                throw new RuntimeException("Rollback verification failed: {$entry['path']}");
            }
            $journal['files'][$index]['status'] = 'restored';
            $this->save($journal);
        }
        Files::writeJson($this->stateRoot . '/registry.json', $journal['beforeRegistry']);
        Files::writeJson($this->stateRoot . '/candidate-registry.json', $journal['beforeRegistry']);
        $journal['registryCommitted'] = false;
        $journal['status'] = 'code-restored';
        $this->save($journal);
    }

    public function checkpoint(string $step, array $operation, array $journal): void
    {
        if (isset($this->config['checkpoint'])) {
            ($this->config['checkpoint'])($step, $operation, $journal);
        }
    }

    private function journalPath(string $id): string
    {
        return Files::path($this->stateRoot, 'journals/' . Files::relative($id) . '.json');
    }
}
