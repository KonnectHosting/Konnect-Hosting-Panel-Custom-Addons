# Addon Manager

A drop-in manager for declared addon packages on an existing Pterodactyl Panel.
It provides an admin page, a durable operation queue, package and patch
validation, retained baseline reconstruction, and standalone file recovery.
The manager lives in `addon-manager/`, outside the host's `addons/` folder.
Version 2.0.1 supports measured stock Panel 1.15.1 sources; Arix Theme 2.1.3
and Addon Pack 2.0.2 are optional supported fixture profiles. Other versions or
source variants require a tested adapter matching the installed files.

This implementation is a development candidate. Repository fixtures identify
Panel 1.15.1, Arix Theme 2.1.3 and Addon Pack 2.0.2; they do not certify an
upgraded production server or every combination of addons. Initial installation
requires a supported adapter matching the **actual installed source**. Unknown
versions, source drift, missing prerequisites and unsupported operations block
with a diagnostic. Keep Arix's licensed/obfuscated code unchanged.

Known fixture limitation: the delivered Arix preset controller has a preexisting
PHP 8.2+ parse fault. The affected preset feature needs a vendor correction and
new tested source adapter. The manager preserves it and validates new/changed
PHP plus isolated host/extension behavior; it does not claim every unchanged
baseline PHP file or Arix feature passed validation.

Start with [the administrator guide](docs/ADMINISTRATOR.md) and run the standalone
installer from an SSH shell as the deployment operator:

```sh
php addon-manager/install.php --panel-root=/var/www/pterodactyl
php addon-manager/bin/manager.php --panel-root=/var/www/pterodactyl doctor
```

Use a fresh `addon-manager/` distribution. Read [the upgrade guide](docs/UPGRADING.md)
before replacing an earlier manager: active legacy registration or state is
refused, and version 2.0.1 does not automatically migrate it.

See the [verification record and remaining limits](docs/VERIFICATION.md) for the
real Panel/Arix tests, supervised lifecycle checks, and download test coverage.

Version 2.0.1 includes the [bug audit and regression fixes](docs/AUDIT.md).

The manager admin page is `/admin/addon-manager`. An authenticated root admin
submits an addon URL; a **dedicated manager worker** performs the operation and
the page polls its persisted result. A working rootless Docker validation runner
is required to activate addon PHP or run native Panel builds. The manager's
prebuilt page itself does not require a Panel frontend rebuild.

Addon authors can start with the [authoring quick start](docs/ADDON-AUTHORING.md),
the [copy-and-paste brief for coding chats](docs/AI-ADDON-BRIEF.md), the
[developer reference](docs/DEVELOPER.md), and the three [SDK examples](sdk/README.md).
Validate and export a self-contained package:

```sh
php addon-manager/sdk/bin/addon.php validate addon-manager/sdk/examples/basic-admin-page
php addon-manager/sdk/bin/addon.php export addon-manager/sdk/examples/basic-admin-page --output=/tmp/addon-manager-demo-1.0.0.zip
```

Export checks the strict manifest, verifies declared checksums, writes a sorted
ZIP with normalized metadata, and re-extracts it through the installer's archive
validator. It also writes a SHA-256 sidecar. A digest identifies bytes; addon
authors and their executable code still need to be trusted.

See [release packaging](docs/RELEASING.md) for a manager-only ZIP and the
[GitHub Actions example](sdk/ci/export-addon.yml) for publishing addon ZIPs.
Declared background jobs use a manager-owned wrapper that skips disabled or
stale addon versions. Schema changes require a manager-created MySQL/MariaDB
snapshot before execution. Disable and delete preserve addon-owned database
data. Filesystem rollback does not reverse database changes or external actions; read the recovery procedure
before production use.
