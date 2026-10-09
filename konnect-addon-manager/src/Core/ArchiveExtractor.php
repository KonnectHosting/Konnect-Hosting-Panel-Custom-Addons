<?php
declare(strict_types=1);

namespace Konnect\AddonManager\Core;

use RuntimeException;
use ZipArchive;

final class ArchiveExtractor
{
    private array $limits;

    public function __construct(array $limits = [])
    {
        $this->limits = $limits + ['maxArchiveBytes'=>67108864,'maxExpandedBytes'=>268435456,'maxEntries'=>10000,'maxRatio'=>200];
        foreach ($this->limits as $limit) { if (!is_int($limit) || $limit < 1) { throw new RuntimeException('Archive limits must be positive integers.'); } }
    }

    public function extract(string $zip, string $destination, ?string $subfolder = null): string
    {
        if (!class_exists(ZipArchive::class)) { throw new RuntimeException('The PHP zip extension is required.'); }
        if (!is_file($zip) || is_link($zip) || filesize($zip) > $this->limits['maxArchiveBytes']) { throw new RuntimeException('Missing or oversized ZIP archive.'); }
        if (file_exists($destination) || is_link($destination)) { throw new RuntimeException('Archive destination must be a new private directory.'); }
        if ($subfolder !== null) { Paths::assertRelative($subfolder); }
        $parent = Paths::realDirectory(dirname($destination));
        Paths::assertRelative(basename($destination));
        $destination = $parent . DIRECTORY_SEPARATOR . basename($destination);
        $archive = new ZipArchive();
        if ($archive->open($zip, ZipArchive::RDONLY) !== true) { throw new RuntimeException('Unable to open ZIP archive.'); }
        $created = false;
        try {
            if ($archive->numFiles < 1 || $archive->numFiles > $this->limits['maxEntries']) { throw new RuntimeException('ZIP entry count is outside allowed limits.'); }
            $entries = []; $names = []; $directories = []; $spellings = []; $total = 0; $compressed = 0;
            for ($i = 0; $i < $archive->numFiles; $i++) {
                $stat = $archive->statIndex($i);
                if ($stat === false || !isset($stat['name'], $stat['size'], $stat['comp_size'])) { throw new RuntimeException('Invalid ZIP entry.'); }
                $directory = str_ends_with($stat['name'], '/');
                $name = $directory ? substr($stat['name'], 0, -1) : $stat['name'];
                Paths::assertRelative($name);
                $folded = strtolower($name);
                $spellingParts = explode('/', $name); $spelling = '';
                foreach ($spellingParts as $part) {
                    $spelling = $spelling === '' ? $part : $spelling . '/' . $part; $key = strtolower($spelling);
                    if (isset($spellings[$key]) && $spellings[$key] !== $spelling) { throw new RuntimeException('Case-colliding ZIP parent directory: ' . $spelling); }
                    $spellings[$key] = $spelling;
                }
                if (isset($names[$folded])) { throw new RuntimeException('Duplicate or case-colliding ZIP entry: ' . $name); }
                $names[$folded] = $directory;
                if (($stat['encryption_method'] ?? 0) !== 0) { throw new RuntimeException('Encrypted ZIP entries are unsupported.'); }
                $opsys = 0; $attributes = 0;
                if ($archive->getExternalAttributesIndex($i, $opsys, $attributes)) {
                    $type = ($attributes >> 16) & 0170000;
                    if ($type !== 0 && $type !== 0100000 && $type !== 0040000) { throw new RuntimeException('ZIP symbolic links and special files are forbidden.'); }
                    if (($type === 0040000) !== $directory && $type !== 0 && ($type === 0040000 || $directory)) { throw new RuntimeException('ZIP entry type mismatch.'); }
                }
                if ($stat['size'] < 0 || $stat['comp_size'] < 0 || ($directory && $stat['size'] !== 0)) { throw new RuntimeException('Invalid ZIP sizes.'); }
                $total += $stat['size']; $compressed += $stat['comp_size'];
                if ($total > $this->limits['maxExpandedBytes'] || $stat['size'] > max(1048576, $stat['comp_size'] * $this->limits['maxRatio'])) { throw new RuntimeException('ZIP expansion limit exceeded.'); }
                $parts = explode('/', $folded); array_pop($parts);
                while ($parts !== []) { $directories[implode('/', $parts)] = true; array_pop($parts); }
                $entries[] = ['index'=>$i,'name'=>$name,'directory'=>$directory,'size'=>$stat['size'],'crc'=>$stat['crc']];
            }
            if ($total > max(1048576, $compressed * $this->limits['maxRatio'])) { throw new RuntimeException('ZIP compression ratio exceeded.'); }
            foreach ($directories as $name => $_) { if (isset($names[$name]) && !$names[$name]) { throw new RuntimeException('ZIP file/directory collision.'); } }
            if (!mkdir($destination, 0700)) { throw new RuntimeException('Unable to create archive destination.'); } $created = true;
            foreach ($entries as $entry) {
                $target = Paths::destination($destination, $entry['name']);
                if ($entry['directory']) {
                    if (!is_dir($target) && !mkdir($target, 0700, true)) { throw new RuntimeException('Unable to create archive directory.'); }
                    continue;
                }
                if (!is_dir(dirname($target)) && !mkdir(dirname($target), 0700, true)) { throw new RuntimeException('Unable to create archive directory.'); }
                $input = $archive->getStream($archive->getNameIndex($entry['index']));
                $output = fopen($target, 'xb');
                if ($input === false || $output === false) { if (is_resource($input)) { fclose($input); } if (is_resource($output)) { fclose($output); } throw new RuntimeException('Unable to extract ZIP file.'); }
                $written = 0; $crc = hash_init('crc32b');
                try {
                    while (!feof($input)) {
                        $chunk = fread($input, 65536);
                        if ($chunk === false) { throw new RuntimeException('ZIP decompression failed.'); }
                        $written += strlen($chunk);
                        if ($written > $entry['size'] || $written > $this->limits['maxExpandedBytes']) { throw new RuntimeException('ZIP exceeded its declared size.'); }
                        hash_update($crc, $chunk);
                        $offset = 0;
                        while ($offset < strlen($chunk)) {
                            $n = fwrite($output, substr($chunk, $offset));
                            if ($n === false || $n === 0) { throw new RuntimeException('Unable to write archive file.'); } $offset += $n;
                        }
                    }
                    if ($written !== $entry['size'] || sprintf('%08x', $entry['crc'] & 0xffffffff) !== hash_final($crc)) { throw new RuntimeException('ZIP integrity check failed.'); }
                } finally { fclose($input); fclose($output); }
                chmod($target, 0600);
            }
            return $this->packageRoot($destination, $subfolder);
        } catch (\Throwable $e) {
            if ($created) { self::removeTree($destination); }
            throw $e;
        } finally { $archive->close(); }
    }

    private function packageRoot(string $destination, ?string $subfolder): string
    {
        if ($subfolder === null && is_file($destination . '/manifest.json')) { return $destination; }
        $children = array_values(array_diff(scandir($destination) ?: [], ['.','..']));
        if (count($children) !== 1 || !is_dir($destination . '/' . $children[0])) { throw new RuntimeException('ZIP must contain one package or one GitHub repository wrapper.'); }
        $root = $destination . '/' . $children[0];
        if ($subfolder !== null) { $root = Paths::destination($root, $subfolder); }
        if (!is_dir($root) || !is_file($root . '/manifest.json')) { throw new RuntimeException('Selected archive folder does not contain manifest.json.'); }
        return $root;
    }

    private static function removeTree(string $directory): void
    {
        foreach (scandir($directory) ?: [] as $name) {
            if ($name === '.' || $name === '..') { continue; }
            $path = $directory . '/' . $name;
            if (is_dir($path) && !is_link($path)) { self::removeTree($path); } else { unlink($path); }
        }
        rmdir($directory);
    }
}
