<?php

declare(strict_types=1);

namespace Konnect\AddonManager\Laravel;

use Konnect\AddonManager\Storage\Files;
use RuntimeException;

/** A manager-owned snapshot precedes any addon DDL. No package supplies commands. */
final class DatabaseBackup
{
    public function __construct(private readonly object $connection, private readonly string $stateRoot)
    {
    }

    public function create(string $operationId): array
    {
        if (!in_array($this->connection->getDriverName(), ['mysql', 'mariadb'], true)) {
            throw new RuntimeException('Addon migrations require the supported MySQL/MariaDB snapshot adapter. Other database drivers need a tested backup adapter.');
        }
        if (!preg_match('/^[A-Za-z0-9_-]{1,128}$/D', $operationId)) {
            throw new RuntimeException('Invalid database backup operation ID.');
        }
        $binary = null;
        foreach (['/usr/bin/mariadb-dump', '/usr/bin/mysqldump', '/usr/local/bin/mysqldump'] as $candidate) {
            if (is_executable($candidate)) {
                $binary = $candidate;
                break;
            }
        }
        if ($binary === null) {
            throw new RuntimeException('Install the matching MySQL/MariaDB dump client for the dedicated worker before installing addons with schema changes.');
        }
        $root = $this->stateRoot . '/database-backups';
        Files::directory($root);
        $file = $root . '/' . $operationId . '.sql';
        $metadata = $file . '.json';
        if (is_file($metadata)) {
            $record = Files::json($metadata);
            if (is_file($file) && hash_file('sha256', $file) === $record['sha256']) {
                return $record;
            }
            throw new RuntimeException('Existing database snapshot is missing or modified.');
        }
        $config = $this->connection->getConfig();
        $databaseName = (string) ($config['database'] ?? '');
        foreach ($this->connection->select('SELECT ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = ?', [$databaseName, 'BASE TABLE']) as $table) {
            if (strtolower((string) $table->engine) !== 'innodb') {
                throw new RuntimeException('The single-transaction database backup adapter supports InnoDB tables only; configure a tested snapshot strategy for other table engines.');
            }
        }
        $defaults = $root . '/.client-' . bin2hex(random_bytes(12)) . '.cnf';
        $temporary = $file . '.tmp-' . bin2hex(random_bytes(6));
        $contents = "[client]\n";
        foreach (['host' => $config['host'] ?? '127.0.0.1', 'port' => (string) ($config['port'] ?? 3306), 'user' => $config['username'] ?? '', 'password' => $config['password'] ?? '', 'default-character-set' => $config['charset'] ?? 'utf8mb4'] as $name => $value) {
            if (!is_scalar($value) || str_contains((string) $value, "\0") || str_contains((string) $value, "\n") || str_contains((string) $value, "\r")) {
                throw new RuntimeException('Database snapshot requires scalar connection settings without control characters.');
            }
            $escaped = str_replace(['\\', '"'], ['\\\\', '\\"'], (string) $value);
            $contents .= $name . '="' . $escaped . "\"\n";
        }
        if (!empty($config['unix_socket'])) {
            $socket = (string) $config['unix_socket'];
            if (preg_match('/[\x00-\x1f]/', $socket)) {
                throw new RuntimeException('Invalid database socket configuration.');
            }
            $contents .= 'socket="' . str_replace(['\\', '"'], ['\\\\', '\\"'], $socket) . "\"\n";
        }
        $ssl = $config['options'] ?? [];
        if (!is_array($ssl)) {
            throw new RuntimeException('Database TLS options must be a supported PDO options map.');
        }
        foreach ([\PDO::MYSQL_ATTR_SSL_CAPATH, \PDO::MYSQL_ATTR_SSL_CIPHER] as $attribute) {
            if (!empty($ssl[$attribute])) {
                throw new RuntimeException('Configured database TLS CA-directory or cipher restrictions require a tested backup adapter; the manager will not omit them from a snapshot connection.');
            }
        }
        $tlsConfigured = false;
        foreach (['ssl-ca' => \PDO::MYSQL_ATTR_SSL_CA, 'ssl-cert' => \PDO::MYSQL_ATTR_SSL_CERT, 'ssl-key' => \PDO::MYSQL_ATTR_SSL_KEY] as $name => $attribute) {
            if (!empty($ssl[$attribute])) {
                $value = $ssl[$attribute];
                if (!is_string($value) || preg_match('/[\x00-\x1f]/', $value) || !is_file($value) || !is_readable($value)) {
                    throw new RuntimeException('Configured database TLS files must be readable by the dedicated backup worker.');
                }
                $contents .= $name . '="' . str_replace(['\\', '"'], ['\\\\', '\\"'], $value) . "\"\n";
                $tlsConfigured = true;
            }
        }
        $sslMode = strtolower((string) ($config['sslmode'] ?? 'prefer'));
        if (!in_array($sslMode, ['prefer', 'require', 'verify-ca', 'verify-full'], true)) {
            throw new RuntimeException('Database TLS mode requires a tested backup adapter.');
        }
        $requireTls = $tlsConfigured || $sslMode !== 'prefer';
        if ($requireTls && array_key_exists(\PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT, $ssl) && !$ssl[\PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT]) {
            throw new RuntimeException('Database snapshots require verified TLS when TLS is configured.');
        }
        if ($requireTls) {
            if (str_ends_with($binary, 'mariadb-dump')) {
                $contents .= "ssl=1\nssl-verify-server-cert=1\n";
            } else {
                $contents .= "ssl-mode=VERIFY_IDENTITY\n";
            }
        }
        Files::atomic($defaults, $contents, 0600);
        $process = null;
        $pipes = [];
        try {
            $database = (string) ($config['database'] ?? '');
            if ($database === '' || str_starts_with($database, '-') || preg_match('/[\x00-\x1f]/', $database)) {
                throw new RuntimeException('Invalid database name for snapshot.');
            }
            $command = [$binary, '--defaults-extra-file=' . $defaults, '--single-transaction', '--skip-lock-tables', '--no-tablespaces', '--hex-blob', '--routines', '--events', '--triggers', '--databases', $database];
            $process = proc_open($command, [0 => ['pipe', 'r'], 1 => ['file', $temporary, 'w'], 2 => ['pipe', 'w']], $pipes);
            if (!is_resource($process)) {
                throw new RuntimeException('Cannot start database snapshot client.');
            }
            chmod($temporary, 0600);
            fclose($pipes[0]);
            stream_set_blocking($pipes[2], false);
            $deadline = microtime(true) + 300;
            do {
                // Dump diagnostics may contain connection details; do not persist them.
                stream_get_contents($pipes[2], 65536);
                $status = proc_get_status($process);
                if (!$status['running']) {
                    break;
                }
                if (microtime(true) > $deadline) {
                    proc_terminate($process);
                    throw new RuntimeException('Database snapshot timed out; no addon schema changes were attempted.');
                }
                usleep(20000);
            } while (true);
            fclose($pipes[2]);
            $exit = proc_close($process);
            $process = null;
            $exit = $exit === -1 ? ($status['exitcode'] ?? -1) : $exit;
            if ($exit !== 0 || !is_file($temporary) || filesize($temporary) === 0) {
                throw new RuntimeException('Database snapshot failed (exit ' . $exit . '). Verify the matching client, connection TLS, snapshot read permissions, and disk space. No addon schema changes were attempted.');
            }
            $handle = fopen($temporary, 'r+');
            if (!$handle) {
                throw new RuntimeException('Cannot verify database snapshot durability.');
            }
            if (function_exists('fsync') && !fsync($handle)) {
                fclose($handle);
                throw new RuntimeException('Database snapshot could not be synchronized to durable storage.');
            }
            fclose($handle);
            if (!rename($temporary, $file)) {
                throw new RuntimeException('Cannot activate database snapshot.');
            }
            if (function_exists('fsync')) {
                $directoryHandle = fopen($root, 'r');
                if (!$directoryHandle || !fsync($directoryHandle)) {
                    if (is_resource($directoryHandle)) fclose($directoryHandle);
                    throw new RuntimeException('Database snapshot directory could not be synchronized to durable storage.');
                }
                fclose($directoryHandle);
            }
            $record = ['operationId' => $operationId, 'path' => $file, 'sha256' => hash_file('sha256', $file), 'bytes' => filesize($file), 'createdAt' => gmdate('c'), 'strategy' => 'mysql-single-transaction', 'scope' => 'full-panel-database'];
            Files::writeJson($metadata, $record);
            return $record;
        } finally {
            if (is_resource($process)) {
                proc_terminate($process);
                $killDeadline = microtime(true) + 1;
                do {
                    if (isset($pipes[2]) && is_resource($pipes[2])) {
                        stream_get_contents($pipes[2], 65536);
                    }
                    $status = proc_get_status($process);
                    if (!$status['running']) break;
                    usleep(20000);
                } while (microtime(true) < $killDeadline);
                if ($status['running']) proc_terminate($process, 9);
                proc_close($process);
            }
            foreach ($pipes as $pipe) {
                if (is_resource($pipe)) fclose($pipe);
            }
            if (is_file($defaults)) unlink($defaults);
            if (is_file($temporary)) unlink($temporary);
        }
    }
}
