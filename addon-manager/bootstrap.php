<?php

declare(strict_types=1);

// This loader deliberately needs neither Composer changes nor Laravel to recover files.
if (!defined('ADDON_MANAGER_VERSION')) {
    define('ADDON_MANAGER_VERSION', '2.0.1');
    spl_autoload_register(static function (string $class): void {
        $prefix = 'AddonManager\\';
        if (!str_starts_with($class, $prefix)) {
            return;
        }
        $relative = substr($class, strlen($prefix));
        if (!preg_match('/^[A-Za-z_][A-Za-z0-9_]*(?:\\\\[A-Za-z_][A-Za-z0-9_]*)*$/D', $relative)) {
            return;
        }
        $file = __DIR__ . '/src/' . str_replace('\\', '/', $relative) . '.php';
        if (is_file($file)) {
            require_once $file;
        }
    });
}
