# Standalone acceptance tests

Run from the Panel root with PHP 8.2+ and the ZIP extension:

```sh
php addon-manager/tests/run.php
php addon-manager/tests/run.php --group=lifecycle
php addon-manager/tests/run.php --group=cli
php addon-manager/tests/run.php --group=laravel-adapter
php addon-manager/tests/run.php --filter='source drift'
php addon-manager/tests/run.php --json=/tmp/addon-manager-test-results.json
```

The runner needs no Composer packages, Laravel bootstrap, database, or external
network. Each case creates and removes its own private fixture. HTTP tests inject
a transport and DNS resolver; ZIP tests construct real archive records including
unsafe names and Unix symlink attributes. Recovery tests terminate separate PHP
workers at deployment checkpoints, then recover through a fresh manager instance.

Exit status is `0` only when at least one selected test ran and all passed; failed
assertions produce `1`, and a zero-test selection or runner error produces `2`.
There are no ignored or expected failures. JSON reports include the executed,
passed, failed, and skipped counts for that invocation.

These tests exercise package safety, dependency reconstruction, source drift,
durable operations, neutral loader and private-state behavior, repeatable bootstrap,
manager version compatibility, legacy-installation refusal, exception rollback,
and crash recovery.
They complement Laravel authorization/CSRF, actual database migration, frontend
build, and browser checks; the standalone suite does not claim to establish those
behaviors.

## Browser smoke

Run the shipped admin markup and assets against a local simulated management API:

```sh
node addon-manager/tests/browser-smoke.cjs
```

This standalone harness requires Node.js 22+ and an installed Chromium executable;
it needs no npm packages, Panel fixture, or external network. Chromium defaults to
`/usr/bin/chromium`. Override the executable and report directory when needed:

```sh
CHROMIUM_BIN=/absolute/path/to/chromium \
ADDON_MANAGER_BROWSER_OUTPUT=/tmp/addon-manager-browser-results \
node addon-manager/tests/browser-smoke.cjs
```

The default output is a fresh temporary directory printed in the JSON report.
It contains `results.json`, screenshots, and a Chromium profile. Checks cover
dependency confirmations, safe text rendering, keyboard focus, responsive themes,
administrator-scoped progress, exact request replay, two-factor/session failures,
ambiguous validation failures, and stale asynchronous responses. Failed assertions
exit nonzero. The simulated API checks client behavior; the separate Laravel suite
checks actual middleware and database behavior. Browser fixtures and outputs are
excluded from the manager release ZIP.

The focused job-dispatch regression uses an installed disposable fixture's real Laravel container,
a recording dispatcher and temporary private registry. It needs no queue service
and never executes an addon handler:

```sh
ADDON_MANAGER_ALLOW_DISPOSABLE_TESTS=1 php addon-manager/tests/JobDispatchIntegration.php /absolute/path/to/disposable/panel
```

The complete Laravel suite uses the fixture's actual Panel HTTP kernel and database:

```sh
ADDON_MANAGER_TEST_PANEL_ROOT=/absolute/path/to/disposable/panel \
ADDON_MANAGER_ALLOW_DISPOSABLE_TESTS=1 \
php addon-manager/tests/LaravelIntegration.php
```

That suite checks the admin session, two-factor and CSRF middleware, response
envelopes, durable HTTP operation delivery, live extension guards, and additive
database migration replay. It temporarily changes the fixture registry, writes
synthetic addon code, and creates its own test table. Use a fixture database; the
explicit disposable-fixture flag is required before those changes run.

The Docker runner suite copies the fixture's frozen baseline into private staging
and executes the real PHP probe in an immutable image:

```sh
ADDON_MANAGER_TEST_PANEL_ROOT=/absolute/path/to/disposable/panel \
ADDON_MANAGER_ALLOW_DISPOSABLE_TESTS=1 \
ADDON_MANAGER_TEST_PHP_IMAGE=sha256:<locally-available-immutable-image-id> \
php addon-manager/tests/RunnerIntegration.php
```

Run as an unprivileged deployment user with the Docker CLI and a local socket.
`ADDON_MANAGER_TEST_DOCKER_HOST` selects a supported rootless Unix socket when needed.
For a disposable development fixture using a rootful daemon, explicitly set
`ADDON_MANAGER_TEST_ALLOW_ROOTFUL_DAEMON=1`; the suite still verifies that the default
policy rejects that daemon. The suite checks actual Laravel boot, declared views
and compiled Blade, handlers, job reflection, invalid new or changed PHP, trusted
baseline hash verification, stage containment, read-only mounts,
network isolation, the absence of fixture credentials and host sockets, and
supervisor policy that excludes the management worker across group spellings.

Run the generated asset receiver suite without Docker or a Panel fixture:

```sh
php addon-manager/tests/NativeBuildIntegration.php
```

It passes independently encoded output streams through the real asset receiver
and verifies path containment, collision and expansion limits, complete streams,
asset references, and SHA384 integrity. It complements the actual offline Node
build; it does not execute Node. These cases are also included in `run.php` and
can be selected with `--group=native-assets`. Both suites accept the runner's
`--filter` and `--json` flags. The Laravel suite writes a report when
`ADDON_MANAGER_TEST_REPORT=/absolute/path/results.json` is set.
