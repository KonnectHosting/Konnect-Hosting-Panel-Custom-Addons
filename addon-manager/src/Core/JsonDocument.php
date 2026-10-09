<?php
declare(strict_types=1);

namespace AddonManager\Core;

use RuntimeException;
use stdClass;

/** Native JSON parsing plus duplicate-member and object/array shape checks. */
final class JsonDocument
{
    public static function decode(string $bytes): array
    {
        try { $object = json_decode($bytes, false, 64, JSON_THROW_ON_ERROR); }
        catch (\JsonException $e) { throw new RuntimeException('Invalid JSON: ' . $e->getMessage(), 0, $e); }
        if (!$object instanceof stdClass) { throw new RuntimeException('JSON document must be an object.'); }
        $offset = 0; self::scan($bytes, $offset);
        foreach (['compatibility','extensions','database','build'] as $key) {
            if (property_exists($object, $key) && !$object->$key instanceof stdClass) { throw new RuntimeException($key . ' must be a JSON object.'); }
        }
        foreach (['dependencies','incompatible','files','patches'] as $key) {
            if (property_exists($object, $key)) { self::objects($object->$key, $key); }
        }
        if (isset($object->extensions)) { foreach ($object->extensions as $key => $entries) { self::objects($entries, 'extensions.' . $key); } }
        if (isset($object->database->migrations)) { self::objects($object->database->migrations, 'database.migrations'); }
        if (isset($object->build) && property_exists($object->build, 'outputs')) { self::array($object->build->outputs, 'build.outputs'); }
        if (property_exists($object, 'operations')) {
            self::objects($object->operations, 'operations');
            foreach ($object->operations as $operation) {
                if (property_exists($operation, 'columns')) {
                    if (($operation->type ?? '') === 'createIndex') { self::array($operation->columns, 'columns'); }
                    else { self::objects($operation->columns, 'columns'); }
                }
                if (property_exists($operation, 'primary')) { self::array($operation->primary, 'primary'); }
            }
        }
        return json_decode($bytes, true, 64, JSON_THROW_ON_ERROR);
    }

    private static function objects(mixed $values, string $name): void
    {
        self::array($values, $name);
        foreach ($values as $value) { if (!$value instanceof stdClass) { throw new RuntimeException($name . ' entries must be JSON objects.'); } }
    }

    private static function array(mixed $values, string $name): void
    {
        if (!is_array($values)) { throw new RuntimeException($name . ' must be a JSON array.'); }
    }

    // Syntax has already passed native parsing. This pass retains every key occurrence.
    private static function scan(string $bytes, int &$offset): void
    {
        self::space($bytes, $offset);
        $kind = $bytes[$offset];
        if ($kind === '{') {
            $offset++; self::space($bytes, $offset); $seen = [];
            if ($bytes[$offset] === '}') { $offset++; return; }
            while (true) {
                $key = json_decode(self::stringToken($bytes, $offset), true, 64, JSON_THROW_ON_ERROR);
                if (isset($seen[$key])) { throw new RuntimeException('Duplicate JSON object member: ' . $key); }
                $seen[$key] = true; self::space($bytes, $offset); $offset++; self::scan($bytes, $offset); self::space($bytes, $offset);
                if ($bytes[$offset++] === '}') { return; }
                self::space($bytes, $offset);
            }
        }
        if ($kind === '[') {
            $offset++; self::space($bytes, $offset);
            if ($bytes[$offset] === ']') { $offset++; return; }
            while (true) {
                self::scan($bytes, $offset); self::space($bytes, $offset);
                if ($bytes[$offset++] === ']') { return; }
            }
        }
        if ($kind === '"') { self::stringToken($bytes, $offset); return; }
        $length = strlen($bytes);
        while ($offset < $length && !str_contains(" \t\r\n,]}:", $bytes[$offset])) { $offset++; }
    }

    private static function stringToken(string $bytes, int &$offset): string
    {
        $start = $offset++;
        while (true) {
            $character = $bytes[$offset++];
            if ($character === '\\') { $offset++; }
            elseif ($character === '"') { return substr($bytes, $start, $offset - $start); }
        }
    }

    private static function space(string $bytes, int &$offset): void { $length = strlen($bytes); while ($offset < $length && str_contains(" \t\r\n", $bytes[$offset])) { $offset++; } }
}
