<?php

declare(strict_types=1);

namespace AddonManager\Laravel;

use Illuminate\Database\Schema\Blueprint;
use AddonManager\Core\ManifestValidator;
use AddonManager\Core\Paths;
use RuntimeException;
use Throwable;

/** Additive DDL is journaled before each step; disable/delete always preserve data. */
final class MigrationExecutor
{
    public function __construct(private readonly object $connection, private readonly string $stateRoot)
    {
    }

    public function apply(array $manifests, array $operation): array
    {
        $applied = [];
        foreach ($manifests as $id => $manifest) {
            foreach ($manifest['database']['migrations'] ?? [] as $migration) {
                $package = $operation['packages'][$id]['packagePath'] ?? null;
                if (!is_string($package)) {
                    throw new RuntimeException('Frozen package path is required for migration: ' . $id);
                }
                $source = Paths::destination($package, $migration['source']);
                if (!is_file($source) || hash_file('sha256', $source) !== $migration['sha256']) {
                    throw new RuntimeException('Migration bytes changed: ' . $id . ':' . $migration['id']);
                }
                $document = json_decode((string) file_get_contents($source), true, 64, JSON_THROW_ON_ERROR);
                $this->validate($id, $document);
                $applied[] = $this->runMigration($id, $migration, $document['operations'], $operation['id']);
            }
        }
        return $applied;
    }

    public function validate(string $addonId, array $document): void
    {
        ManifestValidator::validateMigration($document, $addonId);
        $this->keys($document, ['operations']);
        if (!isset($document['operations']) || !is_array($document['operations']) || !array_is_list($document['operations']) || count($document['operations']) > 100) {
            throw new RuntimeException('Migration operations must be a bounded list.');
        }
        $prefix = str_replace(['.', '-'], '_', $addonId) . '_';
        $createdTables = [];
        foreach ($document['operations'] as $step) {
            if (!is_array($step)) {
                throw new RuntimeException('Invalid database operation.');
            }
            $type = $step['type'] ?? '';
            $this->keys($step, match ($type) {
                'createTable' => ['type', 'table', 'columns', 'primary'],
                'addColumns' => ['type', 'table', 'columns'],
                'createIndex' => ['type', 'table', 'name', 'columns', 'unique'],
                default => throw new RuntimeException('Unsupported additive database operation: ' . $type),
            });
            if (!is_string($step['table'] ?? null) || !str_starts_with($step['table'], $prefix) || str_starts_with($step['table'], 'addon_manager_addon') || !$this->identifier($step['table'])) {
                throw new RuntimeException('Addon tables must use their own prefix: ' . $prefix);
            }
            if (!isset($step['columns']) || !is_array($step['columns']) || !array_is_list($step['columns']) || $step['columns'] === [] || count($step['columns']) > 100) {
                throw new RuntimeException('Database columns must be a nonempty bounded list.');
            }
            if ($type === 'createIndex') {
                if (!$this->identifier($step['name'] ?? '') || isset($step['unique']) && !is_bool($step['unique'])) {
                    throw new RuntimeException('Invalid index declaration.');
                }
                foreach ($step['columns'] as $column) {
                    if (!$this->identifier($column)) {
                        throw new RuntimeException('Invalid index column.');
                    }
                }
                if (($step['unique'] ?? false) && !isset($createdTables[$step['table']])) {
                    throw new RuntimeException('Unique indexes are supported only on a new table created in the same migration; existing-table uniqueness can break previous code.');
                }
                continue;
            }
            $names = [];
            foreach ($step['columns'] as $column) {
                $this->keys($column, ['name', 'type', 'nullable', 'default', 'length']);
                if (!$this->identifier($column['name'] ?? '') || isset($names[$column['name']])) {
                    throw new RuntimeException('Invalid or duplicate migration column.');
                }
                $names[$column['name']] = true;
                if (!in_array($column['type'] ?? '', ['string', 'text', 'integer', 'bigInteger', 'boolean', 'timestamp', 'json'], true)) {
                    throw new RuntimeException('Unsupported database column type.');
                }
                if (isset($column['nullable']) && !is_bool($column['nullable'])) {
                    throw new RuntimeException('Column nullable must be a boolean.');
                }
                if (isset($column['length']) && ($column['type'] !== 'string' || !is_int($column['length']) || $column['length'] < 1 || $column['length'] > 65535)) {
                    throw new RuntimeException('Only string columns support bounded length.');
                }
                if (array_key_exists('default', $column) && !is_scalar($column['default']) && $column['default'] !== null) {
                    throw new RuntimeException('Column defaults must be scalar literals.');
                }
                if ($type === 'addColumns' && !($column['nullable'] ?? false) && !array_key_exists('default', $column)) {
                    throw new RuntimeException('Additive columns require a default or nullable=true.');
                }
            }
            if (isset($step['primary'])) {
                if (!is_array($step['primary']) || !array_is_list($step['primary']) || $step['primary'] === []) {
                    throw new RuntimeException('Invalid primary key.');
                }
                foreach ($step['primary'] as $name) {
                    if (!isset($names[$name])) {
                        throw new RuntimeException('Primary key references an undeclared column.');
                    }
                }
            }
            if ($type === 'createTable') {
                $createdTables[$step['table']] = true;
            }
        }
    }

    private function runMigration(string $id, array $migration, array $steps, string $operationId): array
    {
        $query = $this->connection->table('addon_manager_addon_migrations');
        $key = ['addon_id' => $id, 'migration_id' => $migration['id']];
        $record = $query->where($key)->first();
        if ($record && $record->checksum !== $migration['sha256']) {
            throw new RuntimeException('A migration ID cannot change its checksum: ' . $id . ':' . $migration['id']);
        }
        if ($record && $record->status === 'complete') {
            return ['addonId' => $id, 'migrationId' => $migration['id'], 'status' => 'already-applied'];
        }
        $journalRoot = $this->stateRoot . '/database-journals';
        if (!is_dir($journalRoot) && !mkdir($journalRoot, 0700, true) && !is_dir($journalRoot)) {
            throw new RuntimeException('Cannot create database recovery journal.');
        }
        $journalFile = $journalRoot . '/' . hash('sha256', $id . ':' . $migration['id']) . '.json';
        $journal = is_file($journalFile) ? json_decode((string) file_get_contents($journalFile), true, 128, JSON_THROW_ON_ERROR) : ['addonId' => $id, 'migrationId' => $migration['id'], 'checksum' => $migration['sha256'], 'operationId' => $operationId, 'completedSteps' => [], 'ownedTables' => []];
        if ($journal['checksum'] !== $migration['sha256']) {
            throw new RuntimeException('Migration filesystem checksum conflicts with database ledger.');
        }
        $this->connection->table('addon_manager_addon_migrations')->updateOrInsert($key, ['checksum' => $migration['sha256'], 'status' => 'started', 'operations' => json_encode($steps, JSON_THROW_ON_ERROR), 'started_at' => gmdate('Y-m-d H:i:s')]);
        try {
            foreach ($steps as $index => $step) {
                if (in_array($index, $journal['completedSteps'], true)) {
                    continue;
                }
                $journal['pendingStep'] = $index;
                if ($step['type'] === 'createTable' && !in_array($step['table'], $journal['ownedTables'], true)) {
                    if ($this->connection->getSchemaBuilder()->hasTable($step['table'])) {
                        throw new RuntimeException('Refusing to adopt a pre-existing table: ' . $step['table']);
                    }
                    $journal['ownedTables'][] = $step['table'];
                }
                $this->writeJournal($journalFile, $journal);
                $this->applyStep($step, $journal, $id);
                $journal['completedSteps'][] = $index;
                unset($journal['pendingStep']);
                $this->writeJournal($journalFile, $journal);
            }
            $this->connection->table('addon_manager_addon_migrations')->where($key)->update(['status' => 'complete', 'error' => null, 'completed_at' => gmdate('Y-m-d H:i:s')]);
            $journal['status'] = 'complete';
            $this->writeJournal($journalFile, $journal);
        } catch (Throwable $e) {
            $journal['status'] = 'needs-database-review';
            $journal['error'] = $e->getMessage();
            $this->writeJournal($journalFile, $journal);
            $this->connection->table('addon_manager_addon_migrations')->where($key)->update(['status' => 'needs-database-review', 'error' => $e->getMessage()]);
            throw new RuntimeException('Database migration failed; additive data/schema may remain. Review database journal before recovery: ' . $e->getMessage(), 0, $e);
        }
        return ['addonId' => $id, 'migrationId' => $migration['id'], 'status' => 'complete'];
    }

    private function applyStep(array $step, array $journal, string $addonId): void
    {
        $schema = $this->connection->getSchemaBuilder();
        if ($step['type'] === 'createTable') {
            if (!$schema->hasTable($step['table'])) {
                $schema->create($step['table'], function (Blueprint $table) use ($step): void {
                    foreach ($step['columns'] as $column) {
                        $this->addColumn($table, $column);
                    }
                    if (isset($step['primary'])) {
                        $table->primary($step['primary']);
                    }
                });
            } elseif (!in_array($step['table'], $journal['ownedTables'], true)) {
                throw new RuntimeException('Unowned migration table.');
            }
            foreach ($step['columns'] as $column) {
                $this->assertColumn($step['table'], $column);
            }
            if (isset($step['primary'])) {
                $primary = array_values(array_filter($schema->getIndexes($step['table']), static fn (array $index) => ($index['primary'] ?? false) === true));
                if (count($primary) !== 1 || $primary[0]['columns'] !== $step['primary']) {
                    throw new RuntimeException('Existing primary key conflicts with create-table declaration.');
                }
            }
        } elseif ($step['type'] === 'addColumns') {
            $this->assertOwnedTable($step['table'], $addonId, $journal);
            foreach ($step['columns'] as $column) {
                if ($schema->hasColumn($step['table'], $column['name'])) {
                    $this->assertColumn($step['table'], $column);
                    continue;
                }
                $schema->table($step['table'], fn (Blueprint $table) => $this->addColumn($table, $column));
                $this->assertColumn($step['table'], $column);
            }
        } else {
            $this->assertOwnedTable($step['table'], $addonId, $journal);
            if (($step['unique'] ?? false) && !in_array($step['table'], $journal['ownedTables'], true)) {
                throw new RuntimeException('Existing-table unique index is not compatible with rollback to previous code.');
            }
            foreach ($step['columns'] as $column) {
                if (!$schema->hasColumn($step['table'], $column)) {
                    throw new RuntimeException('Index references missing column: ' . $column);
                }
            }
            foreach ($schema->getIndexes($step['table']) as $index) {
                if ($index['name'] === $step['name']) {
                    if ($index['columns'] !== $step['columns'] || (bool) $index['unique'] !== (bool) ($step['unique'] ?? false)) {
                        throw new RuntimeException('Existing index conflicts with declaration: ' . $step['name']);
                    }
                    return;
                }
            }
            $schema->table($step['table'], static function (Blueprint $table) use ($step): void {
                $method = ($step['unique'] ?? false) ? 'unique' : 'index';
                $table->{$method}($step['columns'], $step['name']);
            });
        }
    }

    private function assertOwnedTable(string $table, string $addonId, array $journal): void
    {
        if (in_array($table, $journal['ownedTables'], true)) {
            return;
        }
        // Prefixes can collide (e.g. test.a and test-a). Only an actual create-table
        // receipt for this exact addon ID proves ownership of an existing table.
        $records = $this->connection->table('addon_manager_addon_migrations')->where('addon_id', $addonId)->where('status', 'complete')->get();
        foreach ($records as $record) {
            $steps = json_decode($record->operations, true, 128, JSON_THROW_ON_ERROR);
            foreach ($steps as $step) {
                if (($step['type'] ?? null) === 'createTable' && ($step['table'] ?? null) === $table) {
                    return;
                }
            }
        }
        throw new RuntimeException('Existing table is not owned by this exact addon migration ledger: ' . $addonId . ':' . $table);
    }

    private function addColumn(Blueprint $table, array $column): mixed
    {
        $definition = $column['type'] === 'string' ? $table->string($column['name'], $column['length'] ?? 255) : $table->{$column['type']}($column['name']);
        $definition->nullable($column['nullable'] ?? false);
        if (array_key_exists('default', $column)) {
            $definition->default($column['default']);
        }
        return $definition;
    }

    private function assertColumn(string $table, array $declaration): void
    {
        $types = ['string' => ['varchar', 'nvarchar', 'character varying'], 'text' => ['text', 'longtext'], 'integer' => ['int', 'integer', 'int4'], 'bigInteger' => ['bigint', 'integer', 'int8'], 'boolean' => ['tinyint', 'boolean', 'bool'], 'timestamp' => ['timestamp', 'datetime'], 'json' => ['json', 'jsonb', 'text', 'longtext']];
        foreach ($this->connection->getSchemaBuilder()->getColumns($table) as $column) {
            if ($column['name'] !== $declaration['name']) {
                continue;
            }
            if (!in_array(strtolower($column['type_name']), $types[$declaration['type']], true) || (bool) $column['nullable'] !== (bool) ($declaration['nullable'] ?? false)) {
                throw new RuntimeException('Existing column conflicts with additive declaration: ' . $table . '.' . $declaration['name']);
            }
            if ($declaration['type'] === 'string' && preg_match('/\((\d+)\)/', $column['type'], $length) && (int) $length[1] !== ($declaration['length'] ?? 255)) {
                throw new RuntimeException('Existing string column length conflicts with declaration.');
            }
            $expectedDefault = $declaration['default'] ?? null;
            $actualDefault = $column['default'];
            if (is_string($actualDefault) && strcasecmp(trim($actualDefault), 'NULL') === 0) {
                $actualDefault = null; // MariaDB exposes SQL NULL as an unquoted string.
            } elseif (is_string($actualDefault) && strlen($actualDefault) >= 2 && $actualDefault[0] === "'" && str_ends_with($actualDefault, "'")) {
                $actualDefault = str_replace("''", "'", substr($actualDefault, 1, -1));
            }
            if ($expectedDefault === null ? $actualDefault !== null : (string) $actualDefault !== (is_bool($expectedDefault) ? ($expectedDefault ? '1' : '0') : (string) $expectedDefault)) {
                throw new RuntimeException('Existing column default conflicts with declaration.');
            }
            return;
        }
        throw new RuntimeException('Expected migration column is missing.');
    }

    private function identifier(mixed $value): bool
    {
        return is_string($value) && preg_match('/^[a-z][a-z0-9_]{0,63}$/D', $value) === 1;
    }

    private function keys(array $object, array $allowed): void
    {
        if (array_diff(array_keys($object), $allowed) !== []) {
            throw new RuntimeException('Unknown declarative database fields.');
        }
    }

    private function writeJournal(string $file, array $journal): void
    {
        $temporary = $file . '.' . bin2hex(random_bytes(6));
        $bytes = json_encode($journal, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n";
        $handle = fopen($temporary, 'xb');
        if (!$handle) {
            throw new RuntimeException('Cannot write database recovery journal.');
        }
        try {
            if (fwrite($handle, $bytes) !== strlen($bytes)) {
                throw new RuntimeException('Incomplete database recovery journal write.');
            }
            fflush($handle);
            if (function_exists('fsync')) {
                fsync($handle);
            }
            chmod($temporary, 0600);
        } finally {
            fclose($handle);
        }
        if (!rename($temporary, $file)) {
            throw new RuntimeException('Cannot activate database recovery journal.');
        }
    }
}
