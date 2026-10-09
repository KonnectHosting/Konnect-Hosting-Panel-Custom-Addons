<?php
declare(strict_types=1);

namespace AddonManager\Core;

use RuntimeException;

final class Paths
{
    /** Package paths are deliberately portable across case-sensitive and insensitive hosts. */
    public static function assertRelative(string $path): string
    {
        if ($path === '' || strlen($path) > 512 || str_contains($path, '\\') || str_starts_with($path, '/') || preg_match('/[\x00-\x20\x7f:%]/', $path)) {
            throw new RuntimeException('Unsafe relative path: ' . $path);
        }
        foreach (explode('/', $path) as $part) {
            if ($part === '' || $part === '.' || $part === '..' || strlen($part) > 255 || !preg_match('/^[A-Za-z0-9_@+.-]+$/D', $part) || str_ends_with($part, '.') || preg_match('/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i', $part)) {
                throw new RuntimeException('Unsafe relative path: ' . $path);
            }
        }
        return $path;
    }

    public static function isProtected(string $path): bool
    {
        $path = strtolower($path);
        foreach (explode('/', $path) as $part) {
            if ($part === '.env' || str_starts_with($part, '.env.') || in_array($part, ['.git', '.svn', '.ssh', '.aws', '.codex', '.agents', 'vendor', 'node_modules', 'addon-manager'], true)) {
                return true;
            }
            if (in_array($part, ['composer.json','composer.lock','package.json','package-lock.json','yarn.lock','pnpm-lock.yaml','.npmrc','.yarnrc','.yarnrc.yml','.babelrc','.babelrc.json','.babelrc.js','.browserslistrc'], true) || preg_match('/^(?:(?:webpack|vite|rollup|postcss|babel|tailwind)\.config\.[cm]?[jt]s|tsconfig(?:\.[a-z0-9_-]+)?\.json|\.pnp\..+)$/', $part)) { return true; }
        }
        if (preg_match('#^(?:storage|addons|arix|bootstrap/cache)(?:/|$)#', $path)) {
            return true;
        }
        // Licensing and obfuscated vendor internals are outside the supported
        // patch surface. Protect route bindings as well as the handlers.
        if (preg_match('#^app/http/(?:controllers/admin/arix|middleware/admin/arix)(?:/|$)#', $path) || in_array($path, ['app/http/controllers/auth/arixcontroller.php','app/helpers/arixaddons.php','config/arix.php','config/arixtheme.php','config/pluginsaddon.php','routes/admin.php','routes/auth.php'], true)) { return true; }
        // These host middleware classes enforce the manager's root-admin,
        // two-factor and CSRF requirements; declared changes cannot replace them.
        if (in_array($path, ['app/http/middleware/adminauthenticate.php','app/http/middleware/requiretwofactorauthentication.php','app/http/middleware/verifycsrftoken.php'], true)) { return true; }
        if (in_array($path, ['artisan', '.htaccess', 'composer.json', 'composer.lock', 'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'webpack.config.js', 'config/app.php', 'config/addon-manager.php', 'bootstrap/app.php', 'app/providers/routeserviceprovider.php', 'app/http/kernel.php', 'resources/views/layouts/admin.blade.php'], true)) {
            return true;
        }
        return str_starts_with($path, 'public/') && (bool) preg_match('/\.(?:php[0-9]?|phtml|phar)(?:\.|$)/i', $path);
    }

    public static function assertTarget(string $path): string
    {
        self::assertRelative($path);
        if (self::isProtected($path)) {
            throw new RuntimeException('Protected destination: ' . $path);
        }
        return $path;
    }

    public static function destination(string $root, string $relative): string
    {
        self::assertRelative($relative);
        $canonical = self::realDirectory($root);
        $current = $canonical;
        foreach (explode('/', $relative) as $part) {
            $current .= DIRECTORY_SEPARATOR . $part;
            if (is_link($current)) {
                throw new RuntimeException('Symbolic links are not permitted in destination paths.');
            }
            if (file_exists($current)) {
                $real = realpath($current);
                if ($real === false || !str_starts_with($real, $canonical . DIRECTORY_SEPARATOR)) {
                    throw new RuntimeException('Destination escapes its root.');
                }
            }
        }
        return $current;
    }

    public static function realDirectory(string $root): string
    {
        $canonical = realpath($root);
        if ($canonical === false || !is_dir($canonical)) { throw new RuntimeException('Root must be a real directory.'); }
        $cursor = rtrim($root, DIRECTORY_SEPARATOR);
        while ($cursor !== '' && $cursor !== '.' && $cursor !== DIRECTORY_SEPARATOR) {
            if (is_link($cursor)) { throw new RuntimeException('Symbolic links are forbidden in directory roots.'); }
            $parent = dirname($cursor); if ($parent === $cursor) { break; } $cursor = $parent;
        }
        return $canonical;
    }

    public static function relative(string $root, string $path): string
    {
        $root = realpath($root);
        $path = realpath($path);
        if ($root === false || $path === false || !str_starts_with($path, $root . DIRECTORY_SEPARATOR)) {
            throw new RuntimeException('Path is outside the expected root.');
        }
        return self::assertRelative(substr($path, strlen($root) + 1));
    }
}
