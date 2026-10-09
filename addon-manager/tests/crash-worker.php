<?php
declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

if (count($argv) !== 5) exit(2);
[$script, $panel, $state, $requested, $marker] = $argv;
$terminate = static function (string $step) use ($requested, $marker): void {
    if ($step !== $requested) return;
    file_put_contents($marker, $step);
    // This is deliberately outside PHP exception handling and finally blocks.
    if (function_exists('posix_kill')) posix_kill(getmypid(), 9);
    exit(137);
};
$manager = new \AddonManager\Lifecycle\Manager($panel, $state, [
    'beforeActivate' => static function (array $operation) use ($marker): void { file_put_contents($marker . '.maintenance', 'maintenance'); },
    'prepareDatabase' => static function (array $manifests, array $operation) use ($state): array {
        $bytes = 'synthetic disposable database recovery snapshot';
        $path = $state . '/database-backups/' . $operation['id'] . '.fixture';
        file_put_contents($path, $bytes);
        return ['path' => $path, 'sha256' => hash('sha256', $bytes), 'bytes' => strlen($bytes), 'strategy' => 'disposable-fixture'];
    },
    'migrate' => static function (array $manifests, array $operation) use ($marker, $terminate): array {
        file_put_contents($marker . '.migration-applied', 'durable additive migration side effect');
        $terminate('insideMigrate');
        return ['compatibleRollback' => true, 'applied' => ['create-records']];
    },
    'checkpoint' => static function (string $step, array $operation, array $journal) use ($terminate): void {
        $terminate($step);
    },
]);
$manager->workOnce();
fwrite(STDERR, 'Worker completed without reaching requested checkpoint ' . $requested . PHP_EOL);
exit(3);
