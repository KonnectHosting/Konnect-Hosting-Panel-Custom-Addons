<?php

declare(strict_types=1);

namespace AddonManager\Laravel;

use Illuminate\Database\Schema\Blueprint;

/** Only the manager owns these tables. Addon migrations cannot target them. */
final class ManagerSchema
{
    public static function install(object $connection): array
    {
        $schema = $connection->getSchemaBuilder();
        $created = [];
        foreach (['addon_manager_addons', 'addon_manager_addon_versions', 'addon_manager_addon_operations', 'addon_manager_addon_dependencies', 'addon_manager_addon_file_changes', 'addon_manager_addon_migrations'] as $name) {
            if ($schema->hasTable($name)) {
                continue;
            }
            $schema->create($name, static function (Blueprint $table) use ($name): void {
                $table->bigIncrements('id');
                if ($name === 'addon_manager_addon_migrations') {
                    $table->string('addon_id', 128);
                    $table->string('migration_id', 128);
                    $table->string('checksum', 64);
                    $table->string('status', 32);
                    $table->longText('operations');
                    $table->text('error')->nullable();
                    $table->timestamp('started_at')->nullable();
                    $table->timestamp('completed_at')->nullable();
                    $table->unique(['addon_id', 'migration_id']);
                } else {
                    $table->string('record_key', 191)->unique();
                    $table->longText('payload');
                    $table->timestamps();
                }
            });
            $created[] = $name;
        }
        return $created;
    }

    public static function mirror(object $connection, array $registry, array $operation): void
    {
        $now = gmdate('Y-m-d H:i:s');
        $connection->transaction(static function () use ($connection, $registry, $operation, $now): void {
            // These three tables describe current committed state. History tables
            // retain previous versions and operation receipts across delete/rollback.
            foreach (['addon_manager_addons', 'addon_manager_addon_dependencies', 'addon_manager_addon_file_changes'] as $table) {
                $connection->table($table)->delete();
            }
            foreach (($registry['addons'] ?? []) as $id => $record) {
                self::put($connection, 'addon_manager_addons', $id, $record, $now);
                self::put($connection, 'addon_manager_addon_versions', $id . '@' . $record['version'], $record, $now);
                foreach ($record['manifest']['dependencies'] ?? [] as $dependency) {
                    self::put($connection, 'addon_manager_addon_dependencies', $id . ':' . $dependency['id'], ['addonId' => $id] + $dependency, $now);
                }
            }
            self::put($connection, 'addon_manager_addon_operations', $operation['id'], $operation, $now);
            foreach (($registry['activeInventory'] ?? []) as $path => $sha256) {
                self::put($connection, 'addon_manager_addon_file_changes', $path, ['path' => $path, 'sha256' => $sha256, 'operationId' => $operation['id']], $now);
            }
        });
    }

    private static function put(object $connection, string $table, string $key, array $payload, string $now): void
    {
        // A valid managed path can exceed a database's indexed varchar limit.
        // Preserve the original identifier inside payload and index its fixed digest.
        $connection->table($table)->updateOrInsert(['record_key' => hash('sha256', $key)], ['payload' => json_encode(['recordKey' => $key] + $payload, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR), 'created_at' => $now, 'updated_at' => $now]);
    }
}
