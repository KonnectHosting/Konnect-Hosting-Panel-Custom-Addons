<?php
declare(strict_types=1);

namespace AddonManager\Core;

use RuntimeException;

final class ManifestValidator
{
    public static function validate(array $manifest): array
    {
        self::keys($manifest, ['manifestVersion','id','name','version','description','compatibility','dependencies','incompatible','files','patches','extensions','database','build'], 'manifest', ['manifestVersion','id','name','version','compatibility']);
        if ($manifest['manifestVersion'] !== 1) { self::fail('manifestVersion must be 1.'); }
        self::id($manifest['id'], 'id');
        self::string($manifest['name'], 'name', 120);
        if (array_key_exists('description', $manifest)) { self::string($manifest['description'], 'description', 2000, true); }
        self::string($manifest['version'], 'version', 128);
        VersionMatcher::assertVersion($manifest['version']);
        self::object($manifest['compatibility'], 'compatibility');
        self::keys($manifest['compatibility'], ['manager','php','panel','arix','addonPack'], 'compatibility', ['manager','php','panel']);
        foreach ($manifest['compatibility'] as $name => $range) { self::constraint($range, 'compatibility.' . $name); }
        foreach (['dependencies','incompatible','files','patches'] as $key) {
            if (!array_key_exists($key, $manifest)) { $manifest[$key] = []; }
            self::list($manifest[$key], $key, 1000);
        }
        $dependencies = [];
        foreach (['dependencies','incompatible'] as $key) {
            $seen = [];
            foreach ($manifest[$key] as $relationship) {
                self::object($relationship, $key);
                self::keys($relationship, ['id','version'], $key, ['id','version']);
                self::id($relationship['id'], $key . '.id');
                self::constraint($relationship['version'], $key . '.version');
                if ($relationship['id'] === $manifest['id'] || isset($seen[$relationship['id']])) { self::fail('Duplicate or self relationship in ' . $key); }
                $seen[$relationship['id']] = true;
                if ($key === 'dependencies') { $dependencies[$relationship['id']] = $relationship['version']; }
                elseif (isset($dependencies[$relationship['id']])) { self::fail('An addon cannot be both a dependency and an incompatibility.'); }
            }
        }
        $targets = [];
        foreach ($manifest['files'] as $file) {
            self::object($file, 'files');
            self::keys($file, ['source','target','sha256'], 'files', ['source','target','sha256']);
            self::path($file['source'], 'files.source'); self::path($file['target'], 'files.target', true); self::hash($file['sha256'], 'files.sha256');
            $folded = strtolower($file['target']);
            if (isset($targets[$folded])) { self::fail('Duplicate file destination: ' . $file['target']); }
            foreach ($targets as $other => $_) {
                if (str_starts_with($folded, $other . '/') || str_starts_with($other, $folded . '/')) { self::fail('File/directory destination collision.'); }
            }
            $targets[$folded] = $file['target'];
        }
        $patchIds = [];
        foreach ($manifest['patches'] as $patch) {
            self::object($patch, 'patches');
            self::keys($patch, ['id','target','owner','find','replace','beforeSha256','afterSha256'], 'patches', ['id','target','owner','find','replace','beforeSha256','afterSha256']);
            self::id($patch['id'], 'patches.id');
            if (isset($patchIds[$patch['id']])) { self::fail('Duplicate patch ID.'); }
            $patchIds[$patch['id']] = true;
            self::path($patch['target'], 'patches.target', true); self::path($patch['find'], 'patches.find'); self::path($patch['replace'], 'patches.replace');
            self::hash($patch['beforeSha256'], 'patches.beforeSha256'); self::hash($patch['afterSha256'], 'patches.afterSha256');
            self::string($patch['owner'], 'patches.owner', 140);
            if (!in_array($patch['owner'], ['panel','arix','baseline'], true)) {
                if (!str_starts_with($patch['owner'], 'addon:') || !isset($dependencies[substr($patch['owner'], 6)])) { self::fail('A patch owner must be panel/arix/baseline or a declared addon dependency.'); }
            }
            if ($patch['owner'] === 'arix' && !isset($manifest['compatibility']['arix'])) { self::fail('Arix patches require arix compatibility.'); }
            if (isset($targets[strtolower($patch['target'])])) { self::fail('A package cannot copy and patch the same destination.'); }
        }
        if (!array_key_exists('extensions', $manifest)) { $manifest['extensions'] = []; }
        self::validateExtensions($manifest['extensions'], $targets);
        if (!array_key_exists('database', $manifest)) { $manifest['database'] = ['dataPolicy'=>'preserve','migrations'=>[]]; }
        self::object($manifest['database'], 'database');
        self::keys($manifest['database'], ['dataPolicy','migrations'], 'database');
        if (!array_key_exists('dataPolicy', $manifest['database'])) { $manifest['database']['dataPolicy'] = 'preserve'; }
        if (!array_key_exists('migrations', $manifest['database'])) { $manifest['database']['migrations'] = []; }
        if ($manifest['database']['dataPolicy'] !== 'preserve') { self::fail('database.dataPolicy must be preserve.'); }
        self::list($manifest['database']['migrations'], 'database.migrations', 100);
        $migrationIds = [];
        foreach ($manifest['database']['migrations'] as $migration) {
            self::object($migration, 'database.migrations');
            self::keys($migration, ['id','source','sha256'], 'database.migrations', ['id','source','sha256']);
            self::id($migration['id'], 'migration.id'); self::path($migration['source'], 'migration.source'); self::hash($migration['sha256'], 'migration.sha256');
            if (!str_ends_with($migration['source'], '.json') || isset($migrationIds[$migration['id']])) { self::fail('Migration sources must be JSON and IDs unique.'); }
            $migrationIds[$migration['id']] = true;
        }
        if (!array_key_exists('build', $manifest)) { $manifest['build'] = ['mode'=>'none']; }
        self::object($manifest['build'], 'build'); self::keys($manifest['build'], ['mode','profile','outputs'], 'build', ['mode']);
        if ($manifest['build']['mode'] === 'none') {
            if (count($manifest['build']) !== 1) { self::fail('Build mode none has no profile or outputs.'); }
        } elseif ($manifest['build']['mode'] === 'panel') {
            if (($manifest['build']['profile'] ?? null) !== 'panel-v1') { self::fail('Unsupported manager-owned build profile.'); }
            self::list($manifest['build']['outputs'] ?? null, 'build.outputs', 1000);
            if ($manifest['build']['outputs'] === []) { self::fail('Panel builds must declare output directories.'); }
            $seen = [];
            foreach ($manifest['build']['outputs'] as $output) {
                self::path($output, 'build.outputs', true);
                if ($output !== 'public/assets' && !str_starts_with($output, 'public/assets/')) { self::fail('Build output must be under public/assets.'); }
                if (isset($seen[strtolower($output)])) { self::fail('Duplicate build output.'); }
                $seen[strtolower($output)] = true;
            }
        } else { self::fail('Unsupported build mode.'); }
        foreach ([...$manifest['files'], ...$manifest['patches']] as $change) {
            if (str_starts_with(strtolower($change['target']), 'resources/scripts/') && $manifest['build']['mode'] !== 'panel') { self::fail('Native frontend source changes require the manager-owned panel build profile.'); }
        }
        return $manifest;
    }

    private static function validateExtensions(mixed $extensions, array $targets): void
    {
        self::object($extensions, 'extensions'); self::keys($extensions, ['pages','routes','menus','events','schedules','jobs'], 'extensions');
        $pages = []; $ids = []; $endpoints = [];
        foreach ($extensions as $kind => $entries) {
            self::list($entries, 'extensions.' . $kind, 100);
            foreach ($entries as $entry) {
                self::object($entry, 'extensions.' . $kind);
                $required = match ($kind) {
                    'pages'=>['id','path','title','view','permission'], 'routes'=>['id','path','method','handler','permission'],
                    'menus'=>['id','label','page'], 'events'=>['id','event','handler','permission'], 'schedules'=>['id','handler','frequency','permission'], 'jobs'=>['id','handler','permission'],
                };
                self::keys($entry, $required, 'extensions.' . $kind, $required); self::id($entry['id'], 'extension.id');
                if (isset($ids[$entry['id']])) { self::fail('Extension IDs must be unique across categories.'); }
                $ids[$entry['id']] = true;
                if (array_key_exists('permission', $entry) && $entry['permission'] !== (in_array($kind, ['events','schedules','jobs'], true) ? 'system' : 'admin')) { self::fail('Unsupported extension permission.'); }
                if (array_key_exists('path', $entry)) {
                    self::string($entry['path'], 'extension.path', 160);
                    if (!preg_match('#^[a-z0-9][a-z0-9_/-]*$#D', $entry['path']) || str_contains($entry['path'], '//') || str_ends_with($entry['path'], '/')) { self::fail('Unsafe extension endpoint.'); }
                    $key = ($entry['method'] ?? 'GET') . ' ' . $entry['path'];
                    if (isset($endpoints[$key])) { self::fail('Duplicate extension endpoint.'); } $endpoints[$key] = true;
                }
                if ($kind === 'pages') {
                    self::string($entry['title'], 'page.title', 120); self::string($entry['view'], 'page.view', 200);
                    $viewPath = 'resources/views/' . str_replace('.', '/', $entry['view']) . '.blade.php';
                    if (!preg_match('/^addons\.[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$/D', $entry['view']) || ($targets[strtolower($viewPath)] ?? null) !== $viewPath) { self::fail('Extension view must map to a declared addons Blade view with matching case.'); }
                    $pages[$entry['id']] = true;
                }
                if ($kind === 'routes' && !in_array($entry['method'], ['GET','POST','PUT','PATCH','DELETE'], true)) { self::fail('Unsupported route method.'); }
                if (array_key_exists('handler', $entry)) {
                    self::string($entry['handler'], 'extension.handler', 220);
                    if (!preg_match('/^Pterodactyl\\\\Addons\\\\([A-Za-z_][A-Za-z0-9_]*(?:\\\\[A-Za-z_][A-Za-z0-9_]*)*)@([A-Za-z_][A-Za-z0-9_]*)$/D', $entry['handler'], $m) || str_starts_with($m[2] ?? '', '__')) { self::fail('Extension handler must map to a declared Pterodactyl Addons class.'); }
                    $handlerPath = 'app/Addons/' . str_replace('\\', '/', $m[1]) . '.php';
                    if (($targets[strtolower($handlerPath)] ?? null) !== $handlerPath) { self::fail('Extension handler declaration must match its class path case.'); }
                }
                if ($kind === 'menus') { self::string($entry['label'], 'menu.label', 100); self::id($entry['page'], 'menu.page'); }
                if ($kind === 'events') {
                    self::string($entry['event'], 'event.event', 220);
                    if (!preg_match('/^[A-Za-z_][A-Za-z0-9_]*(?:\\\\[A-Za-z_][A-Za-z0-9_]*)+$/D', $entry['event'])) { self::fail('Invalid event class.'); }
                }
                if ($kind === 'schedules' && !in_array($entry['frequency'], ['everyMinute','hourly','daily'], true)) { self::fail('Unsupported schedule frequency.'); }
            }
        }
        foreach ($extensions['menus'] ?? [] as $menu) { if (!isset($pages[$menu['page']])) { self::fail('Menu references an undeclared page.'); } }
    }

    public static function validateMigration(array $document, string $addonId): array
    {
        self::keys($document, ['operations'], 'migration', ['operations']); self::list($document['operations'], 'migration.operations', 100);
        if ($document['operations'] === []) { self::fail('Migration must contain an operation.'); }
        $prefix = str_replace(['.','-'], '_', $addonId) . '_';
        foreach ($document['operations'] as $operation) {
            self::object($operation, 'migration operation');
            $type = $operation['type'] ?? null;
            $keys = match ($type) { 'createTable'=>['type','table','columns','primary'], 'addColumns'=>['type','table','columns'], 'createIndex'=>['type','table','name','columns','unique'], default=>throw new RuntimeException('Unsupported migration operation.') };
            self::keys($operation, $keys, 'migration operation', $type === 'createIndex' ? ['type','table','name','columns'] : ['type','table','columns']);
            self::identifier($operation['table'], 'table');
            if (!str_starts_with($operation['table'], $prefix) || strlen($operation['table']) <= strlen($prefix)) { self::fail('Migration table must use addon-owned prefix ' . $prefix); }
            self::list($operation['columns'], 'migration columns', 100);
            if ($operation['columns'] === []) { self::fail('Migration columns cannot be empty.'); }
            $names = [];
            foreach ($operation['columns'] as $column) {
                if ($type === 'createIndex') { self::identifier($column, 'index column'); $name = $column; }
                else {
                    self::object($column, 'column'); self::keys($column, ['name','type','nullable','default','length'], 'column', ['name','type']); self::identifier($column['name'], 'column.name'); $name = $column['name'];
                    if (!in_array($column['type'], ['string','text','integer','bigInteger','boolean','timestamp','json'], true)) { self::fail('Unsupported column type.'); }
                    if (array_key_exists('nullable', $column) && !is_bool($column['nullable'])) { self::fail('nullable must be boolean.'); }
                    if (array_key_exists('length', $column) && ($column['type'] !== 'string' || !is_int($column['length']) || $column['length'] < 1 || $column['length'] > 1024)) { self::fail('Invalid string column length.'); }
                    if (array_key_exists('default', $column)) {
                        $default = $column['default'];
                        $valid = match ($column['type']) {
                            'boolean'=>is_bool($default), 'integer','bigInteger'=>is_int($default), 'string'=>is_string($default) && strlen($default) <= ($column['length'] ?? 255),
                            default=>false,
                        };
                        if (!$valid && !($default === null && ($column['nullable'] ?? false))) { self::fail('Unsupported column default.'); }
                    }
                    if ($type === 'addColumns' && ($column['nullable'] ?? false) !== true && (!array_key_exists('default', $column) || $column['default'] === null)) { self::fail('Added columns must be nullable or have a backward-compatible default.'); }
                }
                if (isset($names[$name])) { self::fail('Duplicate migration column.'); } $names[$name] = true;
            }
            if ($type === 'createIndex') {
                self::identifier($operation['name'], 'index name');
                if (array_key_exists('unique', $operation) && $operation['unique'] !== false) { self::fail('Unique indexes are unsupported: new write constraints are not backward compatible.'); }
            }
            if (array_key_exists('primary', $operation)) {
                self::list($operation['primary'], 'primary', 10);
                if ($operation['primary'] === []) { self::fail('Invalid primary columns.'); }
                $primary = [];
                foreach ($operation['primary'] as $column) { self::identifier($column, 'primary column'); if (!isset($names[$column]) || isset($primary[$column])) { self::fail('Unknown or duplicate primary column.'); } $primary[$column] = true; }
            }
        }
        return $document;
    }

    private static function keys(array $object, array $allowed, string $context, array $required = []): void
    {
        foreach ($object as $key => $_) { if (!is_string($key) || !in_array($key, $allowed, true)) { self::fail('Unknown field in ' . $context . ': ' . $key); } }
        foreach ($required as $key) { if (!array_key_exists($key, $object)) { self::fail('Missing ' . $context . '.' . $key); } }
    }
    private static function object(mixed $value, string $context): void { if (!is_array($value) || ($value !== [] && array_is_list($value))) { self::fail($context . ' must be an object.'); } }
    private static function list(mixed $value, string $context, int $max): void { if (!is_array($value) || !array_is_list($value) || count($value) > $max) { self::fail($context . ' must be a bounded array.'); } }
    private static function string(mixed $value, string $context, int $max, bool $empty = false): void { if (!is_string($value) || (!$empty && trim($value) === '') || strlen($value) > $max || preg_match('//u', $value) !== 1 || preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/', $value)) { self::fail('Invalid ' . $context); } }
    private static function id(mixed $value, string $context): void { self::string($value, $context, 100); if (!preg_match('/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/D', $value)) { self::fail('Invalid ' . $context); } }
    private static function identifier(mixed $value, string $context): void { self::string($value, $context, 64); if (!preg_match('/^[a-z][a-z0-9_]*$/D', $value)) { self::fail('Invalid ' . $context); } }
    private static function constraint(mixed $value, string $context): void { self::string($value, $context, 256); VersionMatcher::assertConstraint($value); }
    private static function hash(mixed $value, string $context): void { if (!is_string($value) || !preg_match('/^[a-f0-9]{64}$/D', $value)) { self::fail('Invalid ' . $context); } }
    private static function path(mixed $value, string $context, bool $target = false): void { self::string($value, $context, 512); $target ? Paths::assertTarget($value) : Paths::assertRelative($value); }
    private static function fail(string $message): never { throw new RuntimeException($message); }
}
