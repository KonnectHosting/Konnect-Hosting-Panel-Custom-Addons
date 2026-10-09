<?php

declare(strict_types=1);

namespace AddonManager\Laravel;

use RuntimeException;

/** Host-owned supervisor policy. No command or service names originate in packages. */
final class WorkerControl
{
    private string $binary;
    private array $groups;
    private int $timeout = 30;

    public function __construct(array $settings)
    {
        if (($settings['driver'] ?? null) !== 'supervisor' || array_diff(array_keys($settings), ['driver', 'binary', 'groups', 'timeout']) !== []) {
            throw new RuntimeException('Configure host workerControl {driver:"supervisor",groups:["pteroq","panel-php-fpm"]} with narrowly scoped supervisor permission for the deployment worker.');
        }
        $timeout = array_key_exists('timeout', $settings) ? $settings['timeout'] : 30;
        if (!is_int($timeout) || $timeout < 1 || $timeout > 300) {
            throw new RuntimeException('Supervisor timeout must be an integer between 1 and 300 seconds.');
        }
        $this->timeout = $timeout;
        $this->binary = $settings['binary'] ?? '/usr/bin/supervisorctl';
        if (!in_array($this->binary, ['/usr/bin/supervisorctl', '/usr/local/bin/supervisorctl'], true) || !is_executable($this->binary)) {
            throw new RuntimeException('Supported supervisorctl binary is unavailable.');
        }
        $this->groups = $settings['groups'] ?? [];
        if (!is_array($this->groups) || !array_is_list($this->groups) || count($this->groups) < 2 || count($this->groups) > 16 || count(array_unique($this->groups)) !== count($this->groups)) {
            throw new RuntimeException('Configure separate affected Panel queue and PHP-FPM supervisor groups; exclude the management worker.');
        }
        foreach ($this->groups as $group) {
            if (!is_string($group) || !preg_match('/^[A-Za-z][A-Za-z0-9_-]{0,63}$/D', $group) || str_contains(strtolower(str_replace(['-', '_'], '', $group)), 'addonmanager')) {
                throw new RuntimeException('Invalid or management-worker supervisor group.');
            }
        }
    }

    public function doctor(): array
    {
        $checks = [];
        foreach ($this->groups as $group) {
            try {
                $response = $this->run('status', $group);
                $states = $this->states($response['output']);
                $checks[] = ['group' => $group, 'passed' => $response['exit'] === 0 && $states !== [] && array_diff($states, ['RUNNING']) === [], 'message' => 'Supervisor status permission and running affected services are required for this group.'];
            } catch (RuntimeException $e) {
                $checks[] = ['group' => $group, 'passed' => false, 'message' => $e->getMessage()];
            }
        }
        return ['ready' => count(array_filter($checks, static fn (array $check) => !$check['passed'])) === 0, 'driver' => 'supervisor', 'checks' => $checks];
    }

    public function stop(): array
    {
        $stopped = [];
        foreach ($this->groups as $group) {
            $status = $this->run('status', $group);
            $states = $this->states($status['output']);
            if ($states !== [] && array_diff($states, ['STOPPED']) === []) {
                $stopped[] = $group;
                continue;
            }
            $this->run('stop', $group);
            $status = $this->run('status', $group);
            $states = $this->states($status['output']);
            if ($states === [] || array_diff($states, ['STOPPED']) !== []) {
                // Never restart earlier groups here: callers may be preparing rollback.
                throw new RuntimeException('Affected Panel group has not quiesced: ' . $group . '; keep maintenance and stopped services until recovery.');
            }
            $stopped[] = $group;
        }
        return ['stopped' => $stopped];
    }

    public function start(): array
    {
        $started = [];
        try {
            foreach (array_reverse($this->groups) as $group) {
                $this->run('start', $group);
                $status = $this->run('status', $group);
                $states = $this->states($status['output']);
                if ($states === [] || array_diff($states, ['RUNNING']) !== []) {
                    throw new RuntimeException('Supervisor could not start affected Panel group ' . $group . '; keep maintenance until service recovery.');
                }
                $started[] = $group;
            }
        } catch (RuntimeException $e) {
            $this->stop();
            throw $e;
        }
        return ['started' => $started];
    }

    private function states(string $output): array
    {
        $states = [];
        foreach (preg_split('/\r?\n/', trim($output)) as $line) {
            if (preg_match('/^[A-Za-z0-9_:\-]+\s+(STOPPED|STARTING|RUNNING|BACKOFF|STOPPING|EXITED|FATAL|UNKNOWN)\b/', $line, $match)) {
                $states[] = $match[1];
            }
        }
        return $states;
    }

    private function run(string $verb, string $group): array
    {
        $process = proc_open([$this->binary, $verb, $group . ':*'], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
        if (!is_resource($process)) {
            throw new RuntimeException('Cannot execute supervised Panel service control.');
        }
        fclose($pipes[0]);
        stream_set_blocking($pipes[1], false);
        stream_set_blocking($pipes[2], false);
        $deadline = microtime(true) + $this->timeout;
        $output = '';
        $diagnosticBytes = 0;
        try {
            do {
                $output .= stream_get_contents($pipes[1], 65536);
                $diagnosticBytes += strlen(stream_get_contents($pipes[2], 65536));
                $status = proc_get_status($process);
                if (strlen($output) + $diagnosticBytes > 65536) {
                    throw new RuntimeException('Supervised service control exceeded its output limit.');
                }
                if (!$status['running']) {
                    break;
                }
                if (microtime(true) > $deadline) {
                    throw new RuntimeException('Supervised service control timed out. Verify stopwaitsecs and scoped permission.');
                }
                usleep(20000);
            } while (true);
            $output .= stream_get_contents($pipes[1], 65536);
            $diagnosticBytes += strlen(stream_get_contents($pipes[2], 65536));
            if (strlen($output) + $diagnosticBytes > 65536) {
                throw new RuntimeException('Supervised service control exceeded its output limit.');
            }
            fclose($pipes[1]);
            fclose($pipes[2]);
            $exit = proc_close($process);
            $process = null;
            return ['exit' => $exit === -1 ? ($status['exitcode'] ?? -1) : $exit, 'output' => $output];
        } finally {
            if (is_resource($process)) {
                $status = proc_get_status($process);
                if ($status['running']) {
                    proc_terminate($process);
                    $killDeadline = microtime(true) + 1;
                    do {
                        stream_get_contents($pipes[1], 65536);
                        stream_get_contents($pipes[2], 65536);
                        $status = proc_get_status($process);
                        if (!$status['running']) break;
                        usleep(20000);
                    } while (microtime(true) < $killDeadline);
                    if ($status['running']) proc_terminate($process, 9);
                }
                foreach ($pipes as $pipe) {
                    if (is_resource($pipe)) fclose($pipe);
                }
                proc_close($process);
            }
        }
    }
}
