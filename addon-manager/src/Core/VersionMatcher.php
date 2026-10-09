<?php
declare(strict_types=1);

namespace AddonManager\Core;

use RuntimeException;

final class VersionMatcher
{
    public static function assertVersion(string $version): string
    {
        if (strlen($version) > 128 || !preg_match('/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/D', $version, $m)) {
            throw new RuntimeException('Invalid semantic version: ' . $version);
        }
        foreach (explode('.', $m[4] ?? '') as $part) {
            if (strlen($part) > 1 && ctype_digit($part) && $part[0] === '0') {
                throw new RuntimeException('Invalid semantic prerelease version: ' . $version);
            }
        }
        return $version;
    }

    public static function assertConstraint(string $constraint): string
    {
        self::parse($constraint);
        return $constraint;
    }

    public static function matches(string $version, string $constraint): bool
    {
        self::assertVersion($version);
        $version = explode('+', $version)[0];
        foreach (self::parse($constraint) as $comparisons) {
            $ok = true;
            $prereleaseAllowed = !str_contains($version, '-');
            foreach ($comparisons as [$operator, $expected]) {
                if (str_contains($expected, '-') && explode('-', $expected)[0] === explode('-', $version)[0]) {
                    $prereleaseAllowed = true;
                }
                $cmp = self::compare($version, $expected);
                $ok = $ok && match ($operator) {
                    '=' => $cmp === 0, '!=' => $cmp !== 0, '>' => $cmp > 0,
                    '>=' => $cmp >= 0, '<' => $cmp < 0, '<=' => $cmp <= 0,
                };
            }
            if ($ok && $prereleaseAllowed) {
                return true;
            }
        }
        return false;
    }

    private static function parse(string $constraint): array
    {
        if ($constraint === '' || strlen($constraint) > 256 || preg_match('/[^0-9A-Za-z.*+^~<>=!|, -]/', $constraint)) {
            throw new RuntimeException('Unsupported version constraint: ' . $constraint);
        }
        $result = [];
        foreach (explode('||', trim($constraint)) as $alternative) {
            $alternative = trim($alternative);
            if ($alternative === '') {
                throw new RuntimeException('Empty version range.');
            }
            if (preg_match('/^([vV]?[0-9][0-9A-Za-z.+-]*)\s+-\s+([vV]?[0-9][0-9A-Za-z.+-]*)$/D', $alternative, $m)) {
                [$lower] = self::partial($m[1]);
                [$upper, $count] = self::partial($m[2]);
                $result[] = [['>=', $lower], [$count === 3 ? '<=' : '<', $count === 3 ? $upper : self::next($upper, $count)]];
                continue;
            }
            $alternative = preg_replace('/(>=|<=|!=|>|<|=|\^|~)\s+/', '$1', $alternative);
            $tokens = preg_split('/[\s,]+/', $alternative);
            $comparisons = [];
            foreach ($tokens as $token) {
                if (!preg_match('/^(>=|<=|!=|>|<|=|\^|~)?([vV]?(?:[0-9]+|[xX*])(?:\.(?:[0-9]+|[xX*])){0,2}(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?)$/D', $token, $m)) {
                    throw new RuntimeException('Unsupported version constraint: ' . $constraint);
                }
                $operator = $m[1] ?: '=';
                [$value, $count] = self::partial($m[2]);
                if ($count === 0) {
                    if ($operator !== '=') {
                        throw new RuntimeException('Wildcard cannot have a range operator.');
                    }
                    continue;
                }
                if ($operator === '^' || $operator === '~') {
                    $parts = explode('.', explode('-', $value)[0]);
                    $index = $operator === '~' ? ($count === 1 ? 0 : 1) : ($parts[0] !== '0' || $count === 1 ? 0 : ($parts[1] !== '0' || $count === 2 ? 1 : 2));
                    $parts[$index] = self::increment($parts[$index]);
                    for ($i = $index + 1; $i < 3; $i++) { $parts[$i] = '0'; }
                    array_push($comparisons, ['>=', $value], ['<', implode('.', $parts)]);
                } elseif ($count < 3 && $operator === '=') {
                    array_push($comparisons, ['>=', $value], ['<', self::next($value, $count)]);
                } elseif ($count < 3 && $operator === '!=') {
                    throw new RuntimeException('Partial exclusion ranges are unsupported.');
                } else {
                    if ($count < 3 && in_array($operator, ['>', '<='], true)) {
                        $value = self::next($value, $count);
                        $operator = $operator === '>' ? '>=' : '<';
                    }
                    $comparisons[] = [$operator, $value];
                }
            }
            $result[] = $comparisons;
        }
        return $result;
    }

    private static function partial(string $version): array
    {
        $version = ltrim($version, 'vV');
        $base = explode('+', explode('-', $version)[0])[0];
        $parts = explode('.', $base);
        $numeric = [];
        $wildcard = false;
        foreach ($parts as $part) {
            if (in_array(strtolower($part), ['x', '*'], true)) { $wildcard = true; continue; }
            if ($wildcard || !ctype_digit($part) || (strlen($part) > 1 && $part[0] === '0')) {
                throw new RuntimeException('Invalid partial version: ' . $version);
            }
            $numeric[] = $part;
        }
        $count = count($numeric);
        $suffix = substr($version, strlen($base));
        if ($suffix !== '' && $count !== 3) { throw new RuntimeException('Prerelease requires a complete version.'); }
        $normalized = implode('.', array_pad($numeric, 3, '0')) . $suffix;
        self::assertVersion($normalized);
        return [explode('+', $normalized)[0], $count];
    }

    private static function next(string $version, int $count): string
    {
        $parts = explode('.', $version);
        $index = max(0, $count - 1); $parts[$index] = self::increment($parts[$index]);
        for ($i = $count; $i < 3; $i++) { $parts[$i] = '0'; }
        return implode('.', $parts);
    }

    private static function compare(string $a, string $b): int
    {
        $ap = explode('-', $a, 2); $bp = explode('-', $b, 2);
        $an = explode('.', $ap[0]); $bn = explode('.', $bp[0]);
        for ($i = 0; $i < 3; $i++) { if ($an[$i] !== $bn[$i]) { return self::numberCompare($an[$i], $bn[$i]); } }
        if (!isset($ap[1]) || !isset($bp[1])) { return isset($ap[1]) ? -1 : (isset($bp[1]) ? 1 : 0); }
        $ai = explode('.', $ap[1]); $bi = explode('.', $bp[1]);
        for ($i = 0; $i < max(count($ai), count($bi)); $i++) {
            if (!isset($ai[$i]) || !isset($bi[$i])) { return isset($ai[$i]) ? 1 : -1; }
            if ($ai[$i] === $bi[$i]) { continue; }
            if (ctype_digit($ai[$i]) && ctype_digit($bi[$i])) { return self::numberCompare($ai[$i], $bi[$i]); }
            if (ctype_digit($ai[$i]) !== ctype_digit($bi[$i])) { return ctype_digit($ai[$i]) ? -1 : 1; }
            return strcmp($ai[$i], $bi[$i]) <=> 0;
        }
        return 0;
    }

    private static function numberCompare(string $a, string $b): int { return strlen($a) === strlen($b) ? (strcmp($a, $b) <=> 0) : (strlen($a) <=> strlen($b)); }

    private static function increment(string $value): string
    {
        for ($i = strlen($value) - 1; $i >= 0; $i--) {
            if ($value[$i] !== '9') { $value[$i] = chr(ord($value[$i]) + 1); return $value; } $value[$i] = '0';
        }
        return '1' . $value;
    }
}
