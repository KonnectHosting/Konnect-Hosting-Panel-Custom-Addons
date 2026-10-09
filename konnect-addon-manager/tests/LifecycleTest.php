<?php
declare(strict_types=1);

use Konnect\AddonManager\Lifecycle\Manager;
use Konnect\AddonManager\Storage\Files;
use function Konnect\AddonManager\Tests\{check, dependencyPackages, fileDeclaration, fixture, manifest, operation, package, rejects, same, temporary, write};

$suite->test('lifecycle', 'B modifies A and removing B restores A while preserving C', function (): void {
    temporary(function (string $root): void {
        $fixture = fixture($root);
        $packages = dependencyPackages($root . '/packages');
        foreach (['a', 'b', 'c'] as $id) operation($fixture, 'install', ['packageRoot' => $packages[$id]]);
        $path = $fixture['panel'] . '/' . $packages['target'];
        same("owned by A\nsummary=B\nfooter=C\n", file_get_contents($path));
        operation($fixture, 'disable', ['addonId' => 'test.b']);
        same("owned by A\nsummary=BASE\nfooter=C\n", file_get_contents($path));
        operation($fixture, 'enable', ['addonId' => 'test.b']);
        same("owned by A\nsummary=B\nfooter=C\n", file_get_contents($path));
        operation($fixture, 'delete', ['addonId' => 'test.b']);
        same("owned by A\nsummary=BASE\nfooter=C\n", file_get_contents($path));
        $registry = $fixture['manager']->registry();
        check(!isset($registry['addons']['test.b']), 'Deleted dependent remains installed');
        check($registry['addons']['test.a']['enabled'] && $registry['addons']['test.c']['enabled'], 'Removing B disabled remaining addons');
        same(hash_file('sha256', $path), $registry['activeInventory'][$packages['target']], 'Active ledger disagrees with composed live bytes');
    });
});

$suite->test('lifecycle', 'independent overlapping patches fail without changing the active installation', function (): void {
    temporary(function (string $root): void {
        $fixture = fixture($root);
        $packages = dependencyPackages($root . '/packages');
        operation($fixture, 'install', ['packageRoot' => $packages['a']]);
        operation($fixture, 'install', ['packageRoot' => $packages['b']]);
        $definition = manifest('test.overlap');
        $definition['dependencies'][] = ['id' => 'test.a', 'version' => '^1.0'];
        $definition['patches'][] = \Konnect\AddonManager\Tests\patchDeclaration('same-summary', $packages['target'], 'addon:test.a', 'find.txt', 'replace.txt', 'summary=BASE', 'summary=OVERLAP');
        $conflict = package($root . '/overlap', $definition, ['find.txt' => 'summary=BASE', 'replace.txt' => 'summary=OVERLAP']);
        $before = file_get_contents($fixture['panel'] . '/' . $packages['target']);
        $inventory = $fixture['manager']->registry()['activeInventory'];
        operation($fixture, 'install', ['packageRoot' => $conflict], 'failed');
        same($before, file_get_contents($fixture['panel'] . '/' . $packages['target']));
        same($inventory, $fixture['manager']->registry()['activeInventory']);
        check(!isset($fixture['manager']->registry()['addons']['test.overlap']), 'Rejected package was registered');
    });
});

$suite->test('lifecycle', 'declared composition patches B and removing it restores B plus the independent C edit', function (): void {
    temporary(function (string $root): void {
        $fixture = fixture($root);
        $packages = dependencyPackages($root . '/packages');
        foreach (['a', 'b', 'c'] as $id) operation($fixture, 'install', ['packageRoot' => $packages[$id]]);
        $composed = manifest('test.composed');
        $composed['dependencies'][] = ['id' => 'test.b', 'version' => '^1.0'];
        $composed['patches'][] = \Konnect\AddonManager\Tests\patchDeclaration('composed-summary', $packages['target'], 'addon:test.b', 'find.txt', 'replace.txt', 'summary=B', 'summary=COMPOSED');
        $path = package($root . '/composed', $composed, ['find.txt' => 'summary=B', 'replace.txt' => 'summary=COMPOSED']);
        operation($fixture, 'install', ['packageRoot' => $path]);
        same("owned by A\nsummary=COMPOSED\nfooter=C\n", file_get_contents($fixture['panel'] . '/' . $packages['target']));
        $changes = array_values(array_filter($fixture['manager']->registry()['ledger'], static fn (array $entry): bool => ($entry['addonId'] ?? null) === 'test.composed'));
        check($changes !== [], 'Composition was not recorded in the actual-change ledger');
        check(array_filter($changes, static fn (array $entry): bool => !empty($entry['parentPatch'])) !== [], 'Composition lost its parent patch provenance');
        operation($fixture, 'delete', ['addonId' => 'test.composed']);
        same("owned by A\nsummary=B\nfooter=C\n", file_get_contents($fixture['panel'] . '/' . $packages['target']));
        check($fixture['manager']->registry()['addons']['test.b']['enabled'], 'Removing composition disabled B');
    });
});

foreach (['payload', 'manifest'] as $corruption) {
    $suite->test('lifecycle', 'corrupted frozen ' . $corruption . ' rejects reconstruction and retains live code', function () use ($corruption): void {
        temporary(function (string $root) use ($corruption): void {
            $fixture = fixture($root);
            $packages = dependencyPackages($root . '/packages');
            operation($fixture, 'install', ['packageRoot' => $packages['a']]);
            $record = $fixture['manager']->registry()['addons']['test.a'];
            if ($corruption === 'payload') write($record['packagePath'] . '/payload/a.blade.php', 'corrupted retained payload');
            else {
                $changed = json_decode(file_get_contents($record['packagePath'] . '/manifest.json'), true, 512, JSON_THROW_ON_ERROR);
                $changed['name'] = 'Corrupted retained manifest';
                write($record['packagePath'] . '/manifest.json', \Konnect\AddonManager\Tests\manifestJson($changed));
            }
            $before = file_get_contents($fixture['panel'] . '/' . $packages['target']);
            $inventory = $fixture['manager']->registry()['activeInventory'];
            operation($fixture, 'install', ['packageRoot' => package($root . '/extra', manifest('test.extra'))], 'failed');
            same($before, file_get_contents($fixture['panel'] . '/' . $packages['target']));
            same($inventory, $fixture['manager']->registry()['activeInventory']);
            check(!isset($fixture['manager']->registry()['addons']['test.extra']), 'Corruption rejection registered the new package');
            same(false, $fixture['manager']->doctor()['ok'], 'Doctor accepted a corrupted retained package');
        });
    });
}

foreach (['changed patch source' => ['1.1.0', "owned by A\nsummary=UPDATED\nfooter=BASE\n"], 'incompatible dependency version' => ['2.0.0', "owned by A\nsummary=BASE\nfooter=BASE\n"]] as $case => [$version, $bytes]) {
    $suite->test('lifecycle', 'updating A with ' . $case . ' rejects and retains A plus B', function () use ($version, $bytes): void {
        temporary(function (string $root) use ($version, $bytes): void {
            $fixture = fixture($root);
            $packages = dependencyPackages($root . '/packages');
            operation($fixture, 'install', ['packageRoot' => $packages['a']]);
            operation($fixture, 'install', ['packageRoot' => $packages['b']]);
            $definition = manifest('test.a', $version);
            $definition['files'][] = fileDeclaration('payload/a.blade.php', $packages['target'], $bytes);
            $update = package($root . '/update', $definition, ['payload/a.blade.php' => $bytes]);
            $before = file_get_contents($fixture['panel'] . '/' . $packages['target']);
            operation($fixture, 'update', ['addonId' => 'test.a', 'packageRoot' => $update], 'failed');
            same($before, file_get_contents($fixture['panel'] . '/' . $packages['target']));
            $registry = $fixture['manager']->registry();
            same('1.0.0', $registry['addons']['test.a']['version']);
            check($registry['addons']['test.b']['enabled'], 'Invalid update deactivated its dependent');
        });
    });
}

foreach (['disable', 'delete'] as $action) {
    $suite->test('lifecycle', $action . ' requires transitive cascade and preserves unrelated addons and data', function () use ($action): void {
        temporary(function (string $root) use ($action): void {
            $fixture = fixture($root);
            $packages = dependencyPackages($root . '/packages');
            operation($fixture, 'install', ['packageRoot' => $packages['a']]);
            operation($fixture, 'install', ['packageRoot' => $packages['b']]);
            $d = manifest('test.d');
            $d['dependencies'][] = ['id' => 'test.b', 'version' => '^1.0'];
            operation($fixture, 'install', ['packageRoot' => package($root . '/d', $d)]);
            $unrelated = manifest('test.unrelated');
            $unrelated['files'][] = fileDeclaration('payload.txt', 'resources/views/unrelated.blade.php', 'unrelated remains');
            operation($fixture, 'install', ['packageRoot' => package($root . '/unrelated', $unrelated, ['payload.txt' => 'unrelated remains'])]);
            write($fixture['panel'] . '/storage/app/test-a/data.json', '{"preserved":true}');
            $result = operation($fixture, $action, ['addonId' => 'test.a'], 'failed');
            $diagnostic = json_encode($result, JSON_THROW_ON_ERROR);
            check(str_contains($diagnostic, 'test.b') && str_contains($diagnostic, 'test.d'), 'Blocked operation did not identify all transitive dependents');
            check($fixture['manager']->registry()['addons']['test.a']['enabled'], 'Blocked operation altered A');
            operation($fixture, $action, ['addonId' => 'test.a', 'cascade' => true]);
            $registry = $fixture['manager']->registry();
            foreach (['test.a', 'test.b', 'test.d'] as $id) {
                if ($action === 'delete') check(!isset($registry['addons'][$id]), 'Cascade retained deleted addon ' . $id);
                else check(!$registry['addons'][$id]['enabled'], 'Cascade left dependent enabled ' . $id);
            }
            check($registry['addons']['test.unrelated']['enabled'], 'Cascade disabled unrelated addon');
            same('unrelated remains', file_get_contents($fixture['panel'] . '/resources/views/unrelated.blade.php'));
            same('{"preserved":true}', file_get_contents($fixture['panel'] . '/storage/app/test-a/data.json'));
            check(!file_exists($fixture['panel'] . '/' . $packages['target']), 'Removed addon-owned file remains live');
        });
    });
}

$suite->test('lifecycle', 'a dependency cycle introduced by update rejects before activation', function (): void {
    temporary(function (string $root): void {
        $fixture = fixture($root);
        operation($fixture, 'install', ['packageRoot' => package($root . '/a', manifest('test.a'))]);
        $b = manifest('test.b');
        $b['dependencies'][] = ['id' => 'test.a', 'version' => '^1.0'];
        operation($fixture, 'install', ['packageRoot' => package($root . '/b', $b)]);
        $a = manifest('test.a', '1.1.0');
        $a['dependencies'][] = ['id' => 'test.b', 'version' => '^1.0'];
        $failed = operation($fixture, 'update', ['addonId' => 'test.a', 'packageRoot' => package($root . '/a-cycle', $a)], 'failed');
        check(str_contains(strtolower(json_encode($failed)), 'cycle'), 'Cycle failure has no useful diagnostic');
        same('1.0.0', $fixture['manager']->registry()['addons']['test.a']['version']);
        check($fixture['manager']->registry()['addons']['test.b']['enabled'], 'Cycle rejection deactivated B');
    });
});

$suite->test('lifecycle', 'source drift blocks reconstruction and retains the manual edit', function (): void {
    temporary(function (string $root): void {
        $fixture = fixture($root);
        $packages = dependencyPackages($root . '/packages');
        operation($fixture, 'install', ['packageRoot' => $packages['a']]);
        write($fixture['panel'] . '/' . $packages['target'], "manual live edit\n");
        $failed = operation($fixture, 'disable', ['addonId' => 'test.a'], 'failed');
        check(preg_match('/drift|changed|unexpected/i', json_encode($failed)) === 1, 'Source drift was not diagnosed');
        same("manual live edit\n", file_get_contents($fixture['panel'] . '/' . $packages['target']));
        check($fixture['manager']->registry()['addons']['test.a']['enabled'], 'Drift rejection committed desired addon state');
    });
});

$suite->test('lifecycle', 'undeclared package bytes fail before any live write', function (): void {
    temporary(function (string $root): void {
        $fixture = fixture($root);
        $packages = dependencyPackages($root . '/packages');
        write($packages['a'] . '/undeclared.txt', 'not part of contract');
        $inventory = $fixture['manager']->registry()['activeInventory'];
        operation($fixture, 'install', ['packageRoot' => $packages['a']], 'failed');
        check(!file_exists($fixture['panel'] . '/' . $packages['target']), 'Invalid package touched live code');
        same($inventory, $fixture['manager']->registry()['activeInventory']);
        same([], $fixture['manager']->listing());
    });
});

$suite->test('lifecycle', 'failed readiness after activation rolls files and registry back', function (): void {
    temporary(function (string $root): void {
        $activated = false;
        $rolledBack = false;
        $fixture = fixture($root, [
            'afterActivate' => static function (array $operation) use (&$activated): void { $activated = true; },
            'healthCheck' => static function (array $operation): void { throw new RuntimeException('Injected readiness failure'); },
            'afterRollback' => static function (array $operation) use (&$rolledBack): void { $rolledBack = true; },
        ]);
        $packages = dependencyPackages($root . '/packages');
        $inventory = $fixture['manager']->registry()['activeInventory'];
        operation($fixture, 'install', ['packageRoot' => $packages['a']], 'failed');
        check($activated && $rolledBack, 'Test did not cross activation and rollback');
        check(!file_exists($fixture['panel'] . '/' . $packages['target']), 'Readiness failure left new code active');
        same($inventory, $fixture['manager']->registry()['activeInventory']);
        same([], $fixture['manager']->listing());
        same("TEST_FIXTURE_ONLY=true\n", file_get_contents($fixture['panel'] . '/.env'));
    });
});

$suite->test('lifecycle', 'invalid PHP syntax fails before activation and cannot report success', function (): void {
    temporary(function (string $root): void {
        $fixture = fixture($root);
        $definition = manifest('test.invalid-php');
        $invalidPhp = '<?php function broken( {';
        $definition['files'][] = fileDeclaration('payload/broken.php', 'app/Services/KonnectBroken.php', $invalidPhp);
        $path = package($root . '/broken', $definition, ['payload/broken.php' => $invalidPhp]);
        $failed = operation($fixture, 'install', ['packageRoot' => $path], 'failed');
        check(preg_match('/syntax|parse/i', json_encode($failed)) === 1, 'PHP failure was not diagnosed');
        check(!file_exists($fixture['panel'] . '/app/Services/KonnectBroken.php'), 'Invalid PHP reached live code');
        same([], $fixture['manager']->listing());
    });
});

foreach (['unchanged', 'patched', 'copied'] as $mode) {
    $suite->test('lifecycle', $mode . ' unused invalid baseline PHP requires exact path and hash before skipping lint', function () use ($mode): void {
        temporary(function (string $root) use ($mode): void {
            $target = 'app/Services/UnusedBaselineFixture.php';
            $invalid = '<?php namespace Pterodactyl\\Services; final class UnusedBaselineFixture { private string $value = getenv("UNUSED_FIXTURE"); }';
            write($root . '/panel/' . $target, $invalid);
            $activated = false;
            $fixture = fixture($root, ['beforeActivate' => static function () use (&$activated): void { $activated = true; }]);
            $before = $fixture['manager']->registry();
            $definition = manifest('test.baseline-' . $mode);
            $payload = [];
            if ($mode === 'patched') {
                $definition['patches'][] = \Konnect\AddonManager\Tests\patchDeclaration('change-unused', $target, 'panel', 'find.txt', 'replace.txt', 'UNUSED_FIXTURE', 'CHANGED_FIXTURE');
                $payload = ['find.txt' => 'UNUSED_FIXTURE', 'replace.txt' => 'CHANGED_FIXTURE'];
            } elseif ($mode === 'copied') {
                $definition['files'][] = fileDeclaration('payload/Copy.php', 'app/Services/CopiedBaselineFixture.php', $invalid);
                $payload = ['payload/Copy.php' => $invalid];
            }
            $result = operation($fixture, 'install', ['packageRoot' => package($root . '/package', $definition, $payload)], $mode === 'unchanged' ? 'succeeded' : 'failed');
            same($mode === 'unchanged', $activated, 'Invalid modified source crossed the activation boundary');
            same($invalid, file_get_contents($fixture['panel'] . '/' . $target));
            same($invalid, file_get_contents($before['baselineRoot'] . '/' . $target));
            same($before['baselineId'], $fixture['manager']->registry()['baselineId']);
            same($before['activeInventory'], $fixture['manager']->registry()['activeInventory']);
            check(!is_file($fixture['panel'] . '/app/Services/CopiedBaselineFixture.php'), 'Identical invalid bytes at a new path reached live code');
            if ($mode === 'unchanged') {
                $syntax = array_values(array_filter($result['validation'], static fn (array $row): bool => $row['name'] === 'php-syntax'))[0];
                same(0, $syntax['checkedFiles']);
                check($syntax['unchangedBaselineFiles'] >= 2, 'Actual frozen PHP hashes were not checked');
                check($fixture['manager']->registry()['addons'][$definition['id']]['enabled'], 'Unchanged unused baseline prevented an unrelated addon');
            } else {
                check(preg_match('/PHP syntax validation failed.*(?:constant expression|syntax|parse)/is', json_encode($result)) === 1, 'Changed or copied invalid PHP was rejected for an unrelated reason');
                same([], $fixture['manager']->listing());
            }
        });
    });
}

foreach (['php', 'manager'] as $product) {
    $suite->test('lifecycle', 'current ' . $product . ' rejects constraints satisfied only by the frozen runtime version', function () use ($product): void {
        temporary(function (string $root) use ($product): void {
            $activated = false;
            $fixture = fixture($root, ['beforeActivate' => static function () use (&$activated): void { $activated = true; }]);
            $before = $fixture['manager']->registry();
            $before['host'][$product] = '99.0.0';
            Files::writeJson($fixture['state'] . '/registry.json', $before);
            $definition = manifest('test.actual-' . $product);
            $definition['compatibility'][$product] = '>=99.0.0';
            $path = package($root . '/package', $definition);
            $manifestHash = hash_file('sha256', $path . '/manifest.json');
            $result = operation($fixture, 'install', ['packageRoot' => $path], 'failed');
            check(str_contains(json_encode($result), 'incompatible with ' . $product), 'Compatibility did not diagnose the actual runtime product');
            same(false, $activated);
            same($before, $fixture['manager']->registry(), 'Runtime rejection rewrote the frozen registry');
            same($manifestHash, hash_file('sha256', $path . '/manifest.json'), 'Compatibility validation rewrote the input manifest');
            same([], $fixture['manager']->listing());
        });
    });
}

$suite->test('lifecycle', 'compatible lifecycle observes actual runtime without rebasing stale frozen versions', function (): void {
    temporary(function (string $root): void {
        $fixture = fixture($root);
        $before = $fixture['manager']->registry();
        $before['host']['php'] = '7.0.0';
        $before['host']['manager'] = '0.5.0';
        Files::writeJson($fixture['state'] . '/registry.json', $before);
        $definition = manifest('test.current-runtime');
        $definition['files'][] = fileDeclaration('payload.txt', 'resources/views/current-runtime.blade.php', 'current runtime payload');
        $path = package($root . '/package', $definition, ['payload.txt' => 'current runtime payload']);
        $manifestHash = hash_file('sha256', $path . '/manifest.json');
        $fixture['manager']->initialize(\Konnect\AddonManager\Tests\host());
        foreach (['install', 'disable', 'delete'] as $action) {
            $arguments = $action === 'install' ? ['packageRoot' => $path] : ['addonId' => $definition['id']];
            $result = operation($fixture, $action, $arguments);
            $after = $fixture['manager']->registry();
            same(PHP_VERSION, $result['validatedHost']['php']);
            same(KONNECT_ADDON_MANAGER_VERSION, $result['validatedHost']['manager']);
            same(PHP_VERSION, $after['observedRuntime']['php']);
            same(KONNECT_ADDON_MANAGER_VERSION, $after['observedRuntime']['manager']);
            same($before['host'], $after['host'], 'A runtime change rebased frozen source identity');
            same($before['baselineId'], $after['baselineId']);
            same($before['baselineInventory'], $after['baselineInventory']);
        }
        same($manifestHash, hash_file('sha256', $path . '/manifest.json'));
        same(true, $fixture['manager']->doctor()['ok']);
    });
});

foreach (['disable', 'delete'] as $action) {
    $suite->test('lifecycle', $action . ' removes a now incompatible addon while validating the remaining current-runtime graph', function () use ($action): void {
        temporary(function (string $root) use ($action): void {
            $fixture = fixture($root);
            $kept = manifest('test.runtime-kept');
            operation($fixture, 'install', ['packageRoot' => package($root . '/kept', $kept)]);
            $obsolete = manifest('test.runtime-obsolete');
            $obsolete['files'][] = fileDeclaration('payload.txt', 'resources/views/obsolete-runtime.blade.php', 'obsolete addon payload');
            operation($fixture, 'install', ['packageRoot' => package($root . '/obsolete', $obsolete, ['payload.txt' => 'obsolete addon payload'])]);
            // Import a coherent private snapshot from a hypothetical earlier
            // runtime: its retained package and digest remain fully verifiable.
            $obsolete['compatibility']['php'] = '>=99.0.0';
            $retained = package($root . '/previous-runtime-package', $obsolete, ['payload.txt' => 'obsolete addon payload']);
            $before = $fixture['manager']->registry();
            $before['host']['php'] = '99.0.0';
            $record = &$before['addons'][$obsolete['id']];
            $record['manifest'] = \Konnect\AddonManager\Core\PackageValidator::validate($retained);
            $record['packagePath'] = $retained;
            $record['packageDigest'] = hash('sha256', json_encode(Files::inventory($retained), JSON_THROW_ON_ERROR));
            unset($record);
            Files::writeJson($fixture['state'] . '/registry.json', $before);
            write($fixture['panel'] . '/storage/app/obsolete-runtime/data.json', '{"preserved":true}');
            $doctor = $fixture['manager']->doctor();
            same(false, $doctor['ok'], 'Enabled obsolete package was not incompatible with the actual runtime');
            $frozen = array_values(array_filter($doctor['checks'], static fn (array $row): bool => $row['name'] === 'frozen-packages'))[0];
            same(true, $frozen['ok'], 'Imported previous-runtime fixture was a corrupted package');
            operation($fixture, $action, ['addonId' => $obsolete['id']]);
            $after = $fixture['manager']->registry();
            check($after['addons'][$kept['id']]['enabled'], 'Removing incompatible addon disabled compatible unrelated code');
            if ($action === 'disable') same(false, $after['addons'][$obsolete['id']]['enabled']);
            else check(!isset($after['addons'][$obsolete['id']]), 'Deleted incompatible addon remained registered');
            check(!is_file($fixture['panel'] . '/resources/views/obsolete-runtime.blade.php'), 'Incompatible addon code remained active');
            same('{"preserved":true}', file_get_contents($fixture['panel'] . '/storage/app/obsolete-runtime/data.json'));
            same($before['baselineId'], $after['baselineId']);
            same(PHP_VERSION, $after['observedRuntime']['php']);
            same(true, $fixture['manager']->doctor()['ok']);
        });
    });
}

$suite->test('lifecycle', 'failed native frontend build retains live code and the failure status', function (): void {
    temporary(function (string $root): void {
        $built = false;
        $fixture = fixture($root, ['build' => static function (string $stage, array $manifests, array $operation) use (&$built): array {
            $built = true;
            throw new RuntimeException('Injected frontend build failure');
        }]);
        $definition = manifest('test.frontend');
        $definition['files'][] = fileDeclaration('payload/fixture.tsx', 'resources/scripts/konnect-fixture.tsx', 'export default "fixture";');
        $definition['build'] = ['mode' => 'panel', 'profile' => 'panel-v1', 'outputs' => ['public/assets']];
        $path = package($root . '/frontend', $definition, ['payload/fixture.tsx' => 'export default "fixture";']);
        $failed = operation($fixture, 'install', ['packageRoot' => $path], 'failed');
        check($built, 'Frontend fixture never entered its build phase');
        check(str_contains(json_encode($failed), 'Injected frontend build failure'), 'Build failure was replaced by a successful status');
        check(!file_exists($fixture['panel'] . '/resources/scripts/konnect-fixture.tsx'), 'Failed frontend source reached live code');
        same([], $fixture['manager']->listing());
    });
});

$suite->test('lifecycle', 'integration verifier undeclared writes fail the actual change audit', function (): void {
    temporary(function (string $root): void {
        $verified = false;
        $fixture = fixture($root, ['verifyStage' => static function (string $stage, array $manifests, array $operation) use (&$verified): array {
            $verified = true;
            write($stage . '/resources/views/undeclared.blade.php', 'undeclared integration write');
            return ['isolated' => true];
        }]);
        $packages = dependencyPackages($root . '/packages');
        $failed = operation($fixture, 'install', ['packageRoot' => $packages['a']], 'failed');
        check($verified, 'Fixture never reached actual-change verification');
        check(preg_match('/undeclared|changed staged/i', json_encode($failed)) === 1, 'Undeclared write was not diagnosed');
        check(!file_exists($fixture['panel'] . '/resources/views/undeclared.blade.php'), 'Undeclared staged write reached live code');
        check(!file_exists($fixture['panel'] . '/' . $packages['target']), 'Rejected staged installation reached live code');
        same([], $fixture['manager']->listing());
    });
});

$suite->test('lifecycle', 'failed commit stops restarted services before restoring live files', function (): void {
    temporary(function (string $root): void {
        $running = false;
        $stoppedBeforeRestore = false;
        $restoredAfterStop = false;
        $target = $root . '/panel/resources/views/addon-a.blade.php';
        $fixture = fixture($root, [
            'committed' => static function (array $operation) use (&$running): void { $running = true; throw new RuntimeException('Injected failure after restarting services'); },
            'beforeRollback' => static function (array $operation) use (&$running, &$stoppedBeforeRestore, $target, $root): void {
                check($running, 'Services had not restarted before injected commit failure');
                check(is_file($target), 'Files were restored before the rollback stop hook');
                check(isset(json_decode(file_get_contents($root . '/state/registry.json'), true)['addons']['test.a']), 'Registry was restored before the rollback stop hook');
                $running = false;
                $stoppedBeforeRestore = true;
            },
            'afterRollback' => static function (array $operation) use (&$running, &$restoredAfterStop, $target): void {
                check(!$running && !file_exists($target), 'Rollback reopened services before restoring code');
                $restoredAfterStop = true;
            },
        ]);
        $packages = dependencyPackages($root . '/packages');
        operation($fixture, 'install', ['packageRoot' => $packages['a']], 'failed');
        check($stoppedBeforeRestore && $restoredAfterStop, 'Test did not exercise both rollback service boundaries');
        same([], $fixture['manager']->listing());
        check(!file_exists($target), 'Failed commit left addon files deployed');
    });
});

$suite->test('lifecycle', 'failed rollback stop hook retains active code until a fresh recovery can quiesce services', function (): void {
    temporary(function (string $root): void {
        $running = false;
        $target = $root . '/panel/resources/views/addon-a.blade.php';
        $fixture = fixture($root, [
            'committed' => static function (array $operation) use (&$running): void { $running = true; throw new RuntimeException('Injected commit failure'); },
            'beforeRollback' => static function (array $operation) use ($target): void {
                check(is_file($target), 'Rollback wrote live files before asking to stop services');
                throw new RuntimeException('Injected failure to stop services');
            },
        ]);
        $packages = dependencyPackages($root . '/packages');
        $failed = operation($fixture, 'install', ['packageRoot' => $packages['a']], 'recovery_required');
        check($running, 'Failure fixture did not retain running services');
        same($packages['original'], file_get_contents($target), 'Unsafe rollback changed live code while services were running');
        check($fixture['manager']->registry()['addons']['test.a']['enabled'], 'Unsafe rollback changed the active registry');
        $fresh = new Manager($fixture['panel'], $fixture['state'], [
            'beforeRollback' => static function (array $operation) use (&$running, $target): void {
                check($running && is_file($target), 'Fresh recovery did not stop services before restoring files');
                $running = false;
            },
            'afterRollback' => static function (array $operation) use (&$running, $target): void { check(!$running && !file_exists($target), 'Fresh recovery did not restore before readiness'); },
        ]);
        same(true, $fresh->recover($failed['id'])['ok']);
        same('recovered', $fresh->operation($failed['id'])['status']);
        same([], $fresh->listing());
        check(!file_exists($target), 'Fresh recovery retained addon code');
    });
});

$suite->test('lifecycle', 'terminal audit failure records a warning and preserves a successful deployment', function (): void {
    temporary(function (string $root): void {
        $observed = 0;
        $rollback = false;
        $fixture = fixture($root, [
            'afterOperation' => static function (array $registry, array $operation) use (&$observed): void {
                same('succeeded', $operation['status'], 'Audit observer ran before the operation committed');
                check($registry['addons']['test.a']['enabled'], 'Audit observer did not receive the committed registry');
                $observed++;
                throw new RuntimeException('Injected audit synchronization failure');
            },
            'beforeRollback' => static function (array $operation) use (&$rollback): void { $rollback = true; },
        ]);
        $packages = dependencyPackages($root . '/packages');
        $result = operation($fixture, 'install', ['packageRoot' => $packages['a']]);
        same(1, $observed);
        check(!$rollback, 'Audit failure triggered a filesystem rollback');
        check(str_contains(json_encode($result['warnings'] ?? []), 'Injected audit synchronization failure'), 'Audit failure was silently discarded');
        same($packages['original'], file_get_contents($fixture['panel'] . '/' . $packages['target']));
        check($fixture['manager']->registry()['addons']['test.a']['enabled'], 'Audit failure changed the successful registry');
    });
});

foreach (['missing adapter', 'missing snapshot', 'altered snapshot'] as $case) {
    $suite->test('lifecycle', $case . ' fails before code activation or database DDL', function () use ($case): void {
        temporary(function (string $root) use ($case): void {
            $ddl = false;
            $activated = false;
            $config = [
                'migrate' => static function (array $manifests, array $operation) use (&$ddl): array { $ddl = true; return ['compatibleRollback' => true]; },
                'afterActivate' => static function (array $operation) use (&$activated): void { $activated = true; },
            ];
            if ($case !== 'missing adapter') $config['prepareDatabase'] = static function (array $manifests, array $operation) use ($root, $case): array {
                $path = $root . '/state/database-backups/' . $operation['id'] . '.fixture';
                $bytes = 'synthetic database snapshot';
                if ($case === 'altered snapshot') write($path, $bytes);
                return ['path' => $path, 'sha256' => str_repeat('0', 64), 'bytes' => strlen($bytes), 'strategy' => 'disposable-fixture'];
            };
            $fixture = fixture($root, $config);
            $definition = manifest('test.database');
            $migration = json_encode(['operations' => [['type' => 'createTable', 'table' => 'test_database_records', 'columns' => [['name' => 'id', 'type' => 'integer']], 'primary' => ['id']]]], JSON_THROW_ON_ERROR);
            $definition['database'] = ['dataPolicy' => 'preserve', 'migrations' => [['id' => 'create-records', 'source' => 'migration.json', 'sha256' => hash('sha256', $migration)]]];
            $definition['files'][] = fileDeclaration('payload.txt', 'resources/views/database.blade.php', 'database fixture view');
            $path = package($root . '/database-package', $definition, ['migration.json' => $migration, 'payload.txt' => 'database fixture view']);
            $failed = operation($fixture, 'install', ['packageRoot' => $path], 'failed');
            check(!$ddl && !$activated, 'Unverified backup allowed activation or schema execution');
            check(!file_exists($fixture['panel'] . '/resources/views/database.blade.php'), 'Unverified backup allowed live code changes');
            check(preg_match('/snapshot|backup|database/i', json_encode($failed)) === 1, 'Snapshot failure has no concrete diagnosis');
            same([], $fixture['manager']->listing());
        });
    });
}

$suite->test('lifecycle', 'repeated request delivery queues and activates only one operation', function (): void {
    temporary(function (string $root): void {
        $activated = 0;
        $fixture = fixture($root, ['afterActivate' => static function (array $operation) use (&$activated): void { $activated++; }]);
        $packages = dependencyPackages($root . '/packages');
        $arguments = ['packageRoot' => $packages['a']];
        $first = $fixture['manager']->enqueue('install', $arguments, 'tests', 'fixture-idempotency-1');
        $second = $fixture['manager']->enqueue('install', $arguments, 'tests', 'fixture-idempotency-1');
        same($first['id'], $second['id']);
        $fixture['manager']->workOnce();
        same('succeeded', $fixture['manager']->operation($first['id'])['status']);
        same(null, $fixture['manager']->workOnce());
        $third = $fixture['manager']->enqueue('install', $arguments, 'tests', 'fixture-idempotency-1');
        same($first['id'], $third['id']);
        same(1, $activated);
        same(1, count($fixture['manager']->listing()));
    });
});

$suite->test('lifecycle', 'rapid dependency installs retain durable FIFO queue order', function (): void {
    temporary(function (string $root): void {
        $fixture = fixture($root);
        $packages = dependencyPackages($root . '/packages');
        $first = $fixture['manager']->enqueue('install', ['packageRoot' => $packages['a']], 'tests');
        $second = $fixture['manager']->enqueue('install', ['packageRoot' => $packages['b']], 'tests');
        $firstResult = $fixture['manager']->workOnce();
        same($first['id'], $firstResult['id'], 'Queue reordered dependency and dependent delivered in the same second');
        same('succeeded', $firstResult['status']);
        $secondResult = $fixture['manager']->workOnce();
        same($second['id'], $secondResult['id']);
        same('succeeded', $secondResult['status']);
        same("owned by A\nsummary=B\nfooter=BASE\n", file_get_contents($fixture['panel'] . '/' . $packages['target']));
        same(null, $fixture['manager']->workOnce());
    });
});

$suite->test('lifecycle', 'a held deployment lock leaves queued operations untouched until release', function (): void {
    temporary(function (string $root): void {
        $fixture = fixture($root);
        $packages = dependencyPackages($root . '/packages');
        $first = $fixture['manager']->enqueue('install', ['packageRoot' => $packages['a']], 'tests');
        $second = $fixture['manager']->enqueue('install', ['packageRoot' => $packages['b']], 'tests');
        $lock = fopen($fixture['state'] . '/deployment.lock', 'c');
        check(is_resource($lock) && flock($lock, LOCK_EX | LOCK_NB), 'Could not acquire fixture deployment lock');
        try {
            same(null, $fixture['manager']->workOnce(), 'A second worker activated code through the held global lock');
            same('queued', $fixture['manager']->operation($first['id'])['status']);
            same('queued', $fixture['manager']->operation($second['id'])['status']);
            check(!file_exists($fixture['panel'] . '/' . $packages['target']), 'Contending worker wrote live files');
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
        same($first['id'], $fixture['manager']->workOnce()['id']);
        same($second['id'], $fixture['manager']->workOnce()['id']);
        same('succeeded', $fixture['manager']->operation($second['id'])['status']);
    });
});

$suite->test('lifecycle', 'stale cascade confirmation rejects at enqueue without a queued mutation', function (): void {
    temporary(function (string $root): void {
        $fixture = fixture($root);
        $packages = dependencyPackages($root . '/packages');
        operation($fixture, 'install', ['packageRoot' => $packages['a']]);
        operation($fixture, 'install', ['packageRoot' => $packages['b']]);
        $d = manifest('test.d');
        $d['dependencies'][] = ['id' => 'test.b', 'version' => '^1.0'];
        operation($fixture, 'install', ['packageRoot' => package($root . '/d', $d)]);
        $inventory = $fixture['manager']->registry()['activeInventory'];
        rejects(static fn () => $fixture['manager']->enqueue('disable', ['addonId' => 'test.a', 'cascade' => true, 'expectedAffectedIds' => ['test.a', 'test.b']], 'tests'), '/affected|changed|confirm|approval/i');
        same(null, $fixture['manager']->workOnce(), 'Rejected confirmation left a runnable operation');
        same($inventory, $fixture['manager']->registry()['activeInventory']);
        foreach (['test.a', 'test.b', 'test.d'] as $id) check($fixture['manager']->registry()['addons'][$id]['enabled'], 'Stale enqueue changed ' . $id);
    });
});

$suite->test('lifecycle', 'a newly installed transitive dependent invalidates an already queued cascade', function (): void {
    temporary(function (string $root): void {
        $fixture = fixture($root);
        $packages = dependencyPackages($root . '/packages');
        operation($fixture, 'install', ['packageRoot' => $packages['a']]);
        operation($fixture, 'install', ['packageRoot' => $packages['b']]);
        $d = manifest('test.d');
        $d['dependencies'][] = ['id' => 'test.b', 'version' => '^1.0'];
        $install = $fixture['manager']->enqueue('install', ['packageRoot' => package($root . '/d', $d)], 'tests');
        $cascade = $fixture['manager']->enqueue('disable', ['addonId' => 'test.a', 'cascade' => true, 'expectedAffectedIds' => ['test.b', 'test.a']], 'tests');
        same($install['id'], $fixture['manager']->workOnce()['id']);
        same('succeeded', $fixture['manager']->operation($install['id'])['status']);
        $inventory = $fixture['manager']->registry()['activeInventory'];
        same($cascade['id'], $fixture['manager']->workOnce()['id']);
        $failed = $fixture['manager']->operation($cascade['id']);
        same('failed', $failed['status'], 'Worker applied a cascade to a dependency set the administrator had not confirmed');
        check(preg_match('/affected|changed|confirm|approval|graph/i', json_encode($failed)) === 1, 'Stale cascade has no actionable diagnostic');
        same($inventory, $fixture['manager']->registry()['activeInventory']);
        foreach (['test.a', 'test.b', 'test.d'] as $id) check($fixture['manager']->registry()['addons'][$id]['enabled'], 'Stale queued cascade changed ' . $id);
        same("owned by A\nsummary=B\nfooter=BASE\n", file_get_contents($fixture['panel'] . '/' . $packages['target']));
    });
});

$suite->test('lifecycle', 'updated dependency metadata invalidates approval even when affected IDs are unchanged', function (): void {
    temporary(function (string $root): void {
        $fixture = fixture($root);
        $packages = dependencyPackages($root . '/packages');
        operation($fixture, 'install', ['packageRoot' => $packages['a']]);
        operation($fixture, 'install', ['packageRoot' => $packages['b']]);
        $b = json_decode(file_get_contents($packages['b'] . '/manifest.json'), true, 512, JSON_THROW_ON_ERROR);
        $b['version'] = '1.1.0';
        $update = package($root . '/b-update', $b, ['patches/find.txt' => 'summary=BASE', 'patches/replace.txt' => 'summary=B']);
        $updated = $fixture['manager']->enqueue('update', ['addonId' => 'test.b', 'packageRoot' => $update], 'tests');
        $cascade = $fixture['manager']->enqueue('disable', ['addonId' => 'test.a', 'cascade' => true, 'expectedAffectedIds' => ['test.a', 'test.b']], 'tests');
        same($updated['id'], $fixture['manager']->workOnce()['id']);
        same('succeeded', $fixture['manager']->operation($updated['id'])['status']);
        same($cascade['id'], $fixture['manager']->workOnce()['id']);
        same('failed', $fixture['manager']->operation($cascade['id'])['status'], 'Worker reused approval for changed dependency metadata');
        $registry = $fixture['manager']->registry();
        same('1.1.0', $registry['addons']['test.b']['version']);
        check($registry['addons']['test.a']['enabled'] && $registry['addons']['test.b']['enabled'], 'Stale graph approval disabled addons');
        same("owned by A\nsummary=B\nfooter=BASE\n", file_get_contents($fixture['panel'] . '/' . $packages['target']));
    });
});

$suite->test('lifecycle', 'delete confirmation includes installed disabled dependents', function (): void {
    temporary(function (string $root): void {
        $fixture = fixture($root);
        $packages = dependencyPackages($root . '/packages');
        operation($fixture, 'install', ['packageRoot' => $packages['a']]);
        operation($fixture, 'install', ['packageRoot' => $packages['b']]);
        operation($fixture, 'disable', ['addonId' => 'test.b', 'expectedAffectedIds' => ['test.b']]);
        rejects(static fn () => $fixture['manager']->enqueue('delete', ['addonId' => 'test.a', 'cascade' => true, 'expectedAffectedIds' => ['test.a']], 'tests'), '/affected|changed|confirm|approval/i');
        operation($fixture, 'delete', ['addonId' => 'test.a', 'cascade' => true, 'expectedAffectedIds' => ['test.b', 'test.a']]);
        same([], $fixture['manager']->listing());
        check(!file_exists($fixture['panel'] . '/' . $packages['target']), 'Confirmed cascade delete retained A files');
    });
});

foreach (['backup:resources/views/base.blade.php', 'beforeRename:resources/views/base.blade.php', 'afterRename:resources/views/base.blade.php', 'codeActivated', 'databaseBackupReady', 'beforeMigrate', 'afterMigrate', 'insideMigrate', 'beforeRegistryCommit', 'afterRegistryCommit'] as $checkpoint) {
    $suite->test('recovery', ($checkpoint === 'insideMigrate' ? 'uncertain migration keeps maintenance and recovery_required at ' : 'terminated worker recovers consistently at ') . $checkpoint, function () use ($checkpoint): void {
        temporary(function (string $root) use ($checkpoint): void {
            $fixture = fixture($root);
            $definition = manifest('test.crash');
            $definition['patches'][] = \Konnect\AddonManager\Tests\patchDeclaration('base', 'resources/views/base.blade.php', 'panel', 'find.txt', 'replace.txt', 'summary=BASE', 'summary=CRASH');
            $definition['files'][] = fileDeclaration('payload.txt', 'resources/views/crash-added.blade.php', 'new crash fixture file');
            $payloads = ['find.txt' => 'summary=BASE', 'replace.txt' => 'summary=CRASH', 'payload.txt' => 'new crash fixture file'];
            if (in_array($checkpoint, ['databaseBackupReady', 'beforeMigrate', 'afterMigrate', 'insideMigrate'], true)) {
                $migration = json_encode(['operations' => [['type' => 'createTable', 'table' => 'test_crash_records', 'columns' => [['name' => 'id', 'type' => 'bigInteger']], 'primary' => ['id']]]], JSON_THROW_ON_ERROR);
                $definition['database'] = ['dataPolicy' => 'preserve', 'migrations' => [['id' => 'create-records', 'source' => 'migrations/records.json', 'sha256' => hash('sha256', $migration)]]];
                $payloads['migrations/records.json'] = $migration;
            }
            $path = package($root . '/crash-package', $definition, $payloads);
            $queued = $fixture['manager']->enqueue('install', ['packageRoot' => $path], 'tests');
            $pipes = [];
            $process = proc_open([PHP_BINARY, __DIR__ . '/crash-worker.php', $fixture['panel'], $fixture['state'], $checkpoint, $root . '/reached'], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
            check(is_resource($process), 'Unable to launch crash worker');
            fclose($pipes[0]);
            $output = stream_get_contents($pipes[1]) . stream_get_contents($pipes[2]);
            fclose($pipes[1]);
            fclose($pipes[2]);
            // Closing stdout can precede the kernel's wait status becoming available.
            $exitDeadline = microtime(true) + 1;
            do {
                $processStatus = proc_get_status($process);
                if (!$processStatus['running']) break;
                usleep(1000);
            } while (microtime(true) < $exitDeadline);
            if ($processStatus['running']) {
                proc_terminate($process, 9);
                proc_close($process);
                throw new RuntimeException('Crash worker retained a running process after closing output streams');
            }
            $exit = proc_close($process);
            check($exit !== 0, 'Worker was not terminated at the requested checkpoint: ' . $output);
            check(($processStatus['signaled'] && $processStatus['termsig'] === 9) || $processStatus['exitcode'] === 137, 'Worker exited through PHP exception handling rather than hard termination: ' . json_encode($processStatus) . ' ' . $output);
            check(is_file($root . '/reached'), 'Requested checkpoint was not reached: ' . $output);
            same($checkpoint, file_get_contents($root . '/reached'));
            $observations = [];
            $fresh = new Manager($fixture['panel'], $fixture['state'], [
                'afterRollback' => static function (array $operation) use ($root): void {
                    if (is_file($root . '/reached.maintenance')) unlink($root . '/reached.maintenance');
                },
                'afterOperation' => static function (array $registry, array $operation) use (&$observations): void {
                    $observations[] = ['registry' => $registry, 'status' => $operation['status']];
                },
            ]);
            same('running', $fresh->operation($queued['id'])['status'], 'Terminated operation did not retain an unfinished durable status');
            $recovery = $fresh->recover($queued['id']);
            $registry = $fresh->registry();
            same(1, count($observations), 'Recovery did not publish its terminal audit result');
            same($registry, $observations[0]['registry'], 'Recovery audit observed stale registry data');
            same($fresh->operation($queued['id'])['status'], $observations[0]['status']);
            if (in_array($checkpoint, ['databaseBackupReady', 'beforeMigrate', 'afterMigrate', 'insideMigrate'], true)) {
                $receipt = $fresh->operation($queued['id'])['databaseBackup'];
                same(true, $receipt['verified'], 'Crash recovery lost the verified database backup receipt');
                same($receipt['sha256'], hash_file('sha256', $receipt['path']), 'Crash recovery altered the retained database backup');
                same($receipt['bytes'], filesize($receipt['path']));
            }
            $enabled = (bool) ($registry['addons']['test.crash']['enabled'] ?? false);
            same($enabled ? "baseline header\nsummary=CRASH\nfooter=BASE\n" : "baseline header\nsummary=BASE\nfooter=BASE\n", file_get_contents($fixture['panel'] . '/resources/views/base.blade.php'), 'Recovery left mixed code/registry state');
            same($enabled, is_file($fixture['panel'] . '/resources/views/crash-added.blade.php'), 'Recovery left a partial new-file deployment');
            foreach ($registry['activeInventory'] as $relative => $digest) same($digest, hash_file('sha256', $fixture['panel'] . '/' . $relative), 'Recovered inventory mismatch at ' . $relative);
            if ($checkpoint === 'insideMigrate') {
                same('recovery_required', $fresh->operation($queued['id'])['status'], 'Uncertain database execution was reported as recovered');
                same(false, $recovery['ok']);
                check(is_file($root . '/reached.maintenance'), 'Recovery reopened the host with uncertain database state');
            } else {
                check(in_array($fresh->operation($queued['id'])['status'], ['recovered', 'succeeded', 'failed'], true), 'Recovered operation is not terminal');
                check(!is_file($root . '/reached.maintenance'), 'Safe recovery did not release maintenance: ' . json_encode($recovery, JSON_THROW_ON_ERROR));
            }
            if (in_array($checkpoint, ['afterMigrate', 'insideMigrate'], true)) same('durable additive migration side effect', file_get_contents($root . '/reached.migration-applied'), 'Filesystem recovery reversed database state');
            $beforeRepeat = $fresh->registry();
            $fresh->recover($queued['id']);
            same($beforeRepeat, $fresh->registry(), 'Repeating recovery altered the registry');
            if ($checkpoint !== 'insideMigrate') same(1, count($observations), 'Repeated completed recovery duplicated its terminal audit notification');
        });
    });
}
