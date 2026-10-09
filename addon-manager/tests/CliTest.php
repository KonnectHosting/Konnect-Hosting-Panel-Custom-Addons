<?php
declare(strict_types=1);

use function AddonManager\Tests\{check, phpCommand, same, temporary};

$suite->test('cli', 'unsupported commands and options reject before Panel boot', function (): void {
    temporary(function (string $root): void {
        $script = dirname(__DIR__) . '/bin/manager.php';
        $cases = [
            [['unknown'], 'Unknown command.'],
            [['doctor', '--cascade'], 'Unsupported option for doctor: --cascade'],
            [['worker', '--url=https://github.com/owner/repo/archive/v1.zip'], 'Unsupported option for worker: --url'],
            [['recover', '--candidate-registry=/unused'], 'Unsupported option for recover: --candidate-registry'],
            [['readiness', '--operation=test-operation'], 'Unsupported option for readiness: --operation'],
            [['install', '--operation=test-operation', '--url=https://github.com/owner/repo/archive/v1.zip'], 'Unsupported option for install: --operation'],
            [['install', '--addon-id=test.example', '--package-root=/unused'], 'Unsupported option for install: --addon-id'],
            [['update', '--once'], 'Unsupported option for update: --once'],
            [['enable', '--cascade', '--addon-id=test.example'], 'Unsupported option for enable: --cascade'],
            [['disable', '--package-root=/unused'], 'Unsupported option for disable: --package-root'],
            [['delete', '--url=https://github.com/owner/repo/archive/v1.zip'], 'Unsupported option for delete: --url'],
            [['operation', '--request-id=unused'], 'Unsupported option for operation: --request-id'],
        ];
        foreach ($cases as [$arguments, $message]) {
            $result = phpCommand($script, [...$arguments, '--panel-root=' . $root]);
            same(1, $result['exit'], 'Invalid CLI invocation succeeded');
            same('', $result['stdout'], 'Rejected invocation printed a success response');
            check(str_contains($result['stderr'], $message), 'Wrong rejection before Panel boot: ' . $result['stderr']);
        }
        same([], array_diff(scandir($root), ['.', '..']), 'CLI validation wrote files to the Panel');
    });
});

$suite->test('cli', 'required lifecycle arguments reject before Panel boot', function (): void {
    temporary(function (string $root): void {
        $script = dirname(__DIR__) . '/bin/manager.php';
        $cases = [
            [['operation'], '--operation is required.'],
            [['install'], 'Provide exactly one --url or --package-root.'],
            [['install', '--url=https://github.com/owner/repo/archive/v1.zip', '--package-root=/unused'], 'Provide exactly one --url or --package-root.'],
            [['update', '--addon-id=test.example'], 'Provide exactly one --url or --package-root.'],
        ];
        foreach (['update', 'enable', 'disable', 'delete'] as $command) $cases[] = [[$command], '--addon-id is required.'];
        foreach ($cases as [$arguments, $message]) {
            $result = phpCommand($script, [...$arguments, '--panel-root=' . $root]);
            same(1, $result['exit']);
            check(str_contains($result['stderr'], $message), 'Required argument reached Panel boot: ' . $result['stderr']);
        }
    });
});

$suite->test('cli', 'valid command options advance to Panel root validation', function (): void {
    temporary(function (string $root): void {
        $script = dirname(__DIR__) . '/bin/manager.php';
        $cases = [
            [], ['doctor'], ['worker', '--once'], ['recover', '--operation=test-operation'],
            ['readiness', '--candidate-registry=/unused'],
            ['install', '--url=https://github.com/owner/repo/archive/v1.zip', '--request-id=stable-request'],
            ['install', '--package-root=/unused'],
            ['update', '--addon-id=test.example', '--package-root=/unused'],
            ['enable', '--addon-id=test.example'],
            ['disable', '--addon-id=test.example', '--cascade'],
            ['delete', '--addon-id=test.example', '--cascade', '--request-id=stable-request'],
            ['operation', '--operation=test-operation'],
        ];
        foreach ($cases as $arguments) {
            foreach ([['--panel-root', $root . '/missing-panel', ...$arguments], [...$arguments, '--panel-root=' . $root . '/missing-panel']] as $invocation) {
                $result = phpCommand($script, $invocation);
                same(1, $result['exit']);
                check(str_contains($result['stderr'], 'Panel root must be a real directory.'), 'Valid CLI options were rejected: ' . $result['stderr']);
            }
        }
        $help = phpCommand($script, ['--help', '--panel-root=' . $root . '/missing-panel']);
        same(0, $help['exit'], 'Help attempted to boot a Panel');
        check(str_contains($help['stdout'], '--request-id=ID'), 'Help does not document lifecycle retry IDs');
    });
});
