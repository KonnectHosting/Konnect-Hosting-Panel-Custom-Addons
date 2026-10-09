<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use PDO;
use PDOException;
use Illuminate\Http\Request;
use Pterodactyl\Models\Server;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Models\Database;
use Pterodactyl\Facades\Activity;
use Pterodactyl\Models\Permission;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Illuminate\Contracts\Encryption\Encrypter;
use Pterodactyl\Http\ViewComposers\AddonsConfiguration;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

class DatabaseImportExportController extends ClientApiController
{
    private const MAX_UPLOAD_KB = 102400;

    private const INSERT_BATCH_SIZE = 500;

    private const FORBIDDEN_STATEMENT_PATTERNS = [
        '/\bDROP\s+DATABASE\b/i',
        '/\bCREATE\s+DATABASE\b/i',
        '/\bGRANT\b/i',
        '/\bREVOKE\b/i',
        '/\bCREATE\s+USER\b/i',
        '/\bDROP\s+USER\b/i',
        '/\bALTER\s+USER\b/i',
        '/\bSET\s+GLOBAL\b/i',
        '/\bSET\s+PASSWORD\b/i',
        '/\bFLUSH\s+PRIVILEGES\b/i',
        '/\bLOAD_FILE\s*\(/i',
        '/\bINTO\s+OUTFILE\b/i',
        '/\bINTO\s+DUMPFILE\b/i',
        '/\bSHUTDOWN\b/i',
        '/\bKILL\s+\d/i',
    ];

    public function __construct(
        private AddonsConfiguration $addonsConfiguration,
        private Encrypter $encrypter,
    ) {
        parent::__construct();
    }

    /**
     * Streams a full SQL dump (schema + data) of the given database back to the client.
     *
     * @throws \Throwable
     */
    public function export(Request $request, Server $server, Database $database): StreamedResponse
    {
        $this->authorizeAccess($request, $server);

        $pdo = $this->connect($database);
        $filename = $database->database . '-' . now()->format('Y-m-d_His') . '.sql';

        Activity::event('server:database.export')
            ->subject($database)
            ->property('name', $database->database)
            ->log();

        return response()->streamDownload(function () use ($pdo, $database) {
            echo "-- Database export for `{$database->database}`\n";
            echo '-- Generated: ' . now()->toDateTimeString() . "\n\n";
            echo "SET FOREIGN_KEY_CHECKS=0;\n\n";

            foreach ($pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) as $table) {
                $this->dumpTable($pdo, $table);
            }

            echo "SET FOREIGN_KEY_CHECKS=1;\n";
        }, $filename, ['Content-Type' => 'application/sql']);
    }

    /**
     * Executes an uploaded SQL file against the given database, optionally wiping all
     * existing tables first.
     *
     * @throws \Throwable
     */
    public function import(Request $request, Server $server, Database $database): JsonResponse
    {
        $this->authorizeAccess($request, $server);

        $request->validate([
            'sql' => ['required', 'file', 'max:' . self::MAX_UPLOAD_KB, 'extensions:sql'],
            'wipe' => ['sometimes', 'boolean'],
        ]);

        $sql = file_get_contents($request->file('sql')->getRealPath());
        if ($sql === false || trim($sql) === '') {
            throw new BadRequestHttpException('The uploaded file is empty or could not be read.');
        }

        $this->assertSafeSql($sql);

        $pdo = $this->connect($database);
        $wipe = $request->boolean('wipe');

        try {
            if ($wipe) {
                $this->wipeDatabase($pdo);
            }

            $pdo->exec($sql);
        } catch (PDOException $exception) {
            throw new UnprocessableEntityHttpException('The import failed: ' . $exception->getMessage());
        }

        Activity::event('server:database.import')
            ->subject($database)
            ->property('name', $database->database)
            ->property('wipe', $wipe)
            ->log();

        return response()->json(['message' => 'The database was imported successfully.']);
    }

    private function authorizeAccess(Request $request, Server $server): void
    {
        if (!$request->user()->can(Permission::ACTION_DATABASE_VIEW_PASSWORD, $server)) {
            throw new AccessDeniedHttpException('You do not have permission to import or export databases for this server.');
        }

        $addon = $this->addonsConfiguration->getAddon('databaseImportExport');

        if (!$addon['enabled']) {
            throw new AccessDeniedHttpException('This feature is not currently enabled.');
        }

        if (!empty($addon['nests']) && !in_array($server->nest_id, $addon['nests'], true)) {
            throw new AccessDeniedHttpException('This feature is not available for this server.');
        }

        if (!empty($addon['eggs']) && !in_array($server->egg_id, $addon['eggs'], true)) {
            throw new AccessDeniedHttpException('This feature is not available for this server.');
        }
    }

    private function connect(Database $database): PDO
    {
        $database->loadMissing('host');
        $host = $database->host;

        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $host->host, $host->port, $database->database);

        try {
            return new PDO($dsn, $database->username, $this->encrypter->decrypt($database->password), [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::MYSQL_ATTR_MULTI_STATEMENTS => true,
                PDO::ATTR_TIMEOUT => 15,
            ]);
        } catch (PDOException) {
            throw new BadRequestHttpException('Unable to connect to this database. Verify the "Connections From" restriction for this database allows access from the panel.');
        }
    }

    private function dumpTable(PDO $pdo, string $table): void
    {
        $identifier = $this->quoteIdentifier($table);

        $createRow = $pdo->query("SHOW CREATE TABLE {$identifier}")->fetch(PDO::FETCH_ASSOC);
        echo "DROP TABLE IF EXISTS {$identifier};\n";
        echo $createRow['Create Table'] . ";\n\n";

        $statement = $pdo->query("SELECT * FROM {$identifier}");

        $columns = null;
        $batch = [];

        while ($row = $statement->fetch(PDO::FETCH_ASSOC)) {
            if ($columns === null) {
                $columns = array_map([$this, 'quoteIdentifier'], array_keys($row));
            }

            $values = array_map(fn ($value) => $value === null ? 'NULL' : $pdo->quote($value), $row);
            $batch[] = '(' . implode(',', $values) . ')';

            if (count($batch) >= self::INSERT_BATCH_SIZE) {
                $this->flushInsertBatch($identifier, $columns, $batch);
            }
        }

        if (!empty($batch)) {
            $this->flushInsertBatch($identifier, $columns, $batch);
        }

        echo "\n";
    }

    private function flushInsertBatch(string $identifier, array $columns, array &$batch): void
    {
        echo "INSERT INTO {$identifier} (" . implode(',', $columns) . ') VALUES ' . implode(',', $batch) . ";\n";
        $batch = [];
    }

    private function wipeDatabase(PDO $pdo): void
    {
        $pdo->exec('SET FOREIGN_KEY_CHECKS=0');

        foreach ($pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) as $table) {
            $pdo->exec('DROP TABLE IF EXISTS ' . $this->quoteIdentifier($table));
        }

        $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
    }

    private function quoteIdentifier(string $identifier): string
    {
        return '`' . str_replace('`', '``', $identifier) . '`';
    }

    private function assertSafeSql(string $sql): void
    {
        foreach (self::FORBIDDEN_STATEMENT_PATTERNS as $pattern) {
            if (preg_match($pattern, $sql) === 1) {
                throw new UnprocessableEntityHttpException('The uploaded SQL file contains a statement that is not permitted.');
            }
        }
    }
}