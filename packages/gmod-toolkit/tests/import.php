<?php
declare(strict_types=1);

require dirname(__DIR__, 3) . '/addon-manager/bootstrap.php';
require dirname(__DIR__, 3) . '/addon-manager/tests/Support.php';

use AddonManager\Core\ArchiveExtractor;
use AddonManager\Core\PackageValidator;

$archive = realpath($argv[1] ?? '');
if (!$archive || !is_file($archive)) { throw new RuntimeException('Supply the actual repository archive.'); }
$temp = sys_get_temp_dir() . '/gmod-toolkit-import-' . bin2hex(random_bytes(12));
mkdir($temp, 0700);
try {
    $folder = ($argv[2] ?? '') === '-' ? null : 'packages/gmod-toolkit/addon';
    $package = (new ArchiveExtractor())->extract($archive, $temp . '/extracted', $folder);
    $manifest = PackageValidator::validate($package);
    if ($manifest['id'] !== 'gmod.toolkit' || $manifest['version'] !== '1.1.2') { throw new RuntimeException('Unexpected package identity.'); }
    echo json_encode(['importable' => true, 'id' => $manifest['id'], 'version' => $manifest['version'], 'archiveBytes' => filesize($archive)], JSON_THROW_ON_ERROR) . "\n";
} finally { \AddonManager\Tests\remove($temp); }
