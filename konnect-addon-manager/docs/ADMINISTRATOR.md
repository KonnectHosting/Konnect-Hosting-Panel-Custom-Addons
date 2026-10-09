# Installing and operating the manager

Install the manager on an already functioning Panel with the intended Arix theme
and Addon Pack already activated. The bundled `arix/` and `addons/` version
folders are source fixtures; they do not establish what is running on a server.
The installer measures deployed files and rejects an unknown source profile.
Check the candidate against your upgraded versions before scheduling a
production change. A successful package validation alone does not prove login,
console or existing theme/addon behavior.

The current adapter distinguishes stock Panel 1.15.1, Panel with Arix 2.1.3,
and Panel with Arix 2.1.3 plus Addon Pack 2.0.2. Arix profiles separately match
the bundled payload-overlay controller bytes and the version-pinned controllers
delivered by its installer. These are measured source variants, not a guarantee
for every installation displaying those version numbers. Detection checks
deployed files; it never reconstructs a live installation from fixture folders.

The measured Arix installer-delivery `ArixPresetController.php` has an existing
PHP 8.2+ parse fault: a private property initializer calls `base64_decode()`.
The host can boot without loading this controller, but the affected Arix preset
feature is broken when invoked. Treat the matching doctor advisory as a host
feature defect, not a successful preset-feature check. The manager retains that
vendor file unchanged. Obtain a vendor-corrected controller, validate a new
source adapter and follow a verified baseline maintenance procedure before
claiming that feature works; do not alter obfuscation or licensing checks.

## Prepare and install

Keep a tested backup of the database, deployed code/assets and `.env` outside
the manager. Arrange a maintenance window and confirm how to stop/restart PHP,
queue workers and scheduled work. Preserve the Panel's existing nginx layout.
Use PHP 8.2+ with its Panel-required extensions and ext-zip; native frontend
changes also require the matched host toolchain and retained dependencies.

A release ZIP contains just the `konnect-addon-manager/` folder. Download the
ZIP and checksum from a reviewed release through SSH, verify the checksum from
a trusted release source, inspect the contents, then extract into the existing
Panel root. For example, with the release files already in `/tmp/`:

```sh
cd /tmp
sha256sum -c konnect-addon-manager.zip.sha256
unzip -l konnect-addon-manager.zip
unzip konnect-addon-manager.zip -d /var/www/pterodactyl
cd /var/www/pterodactyl
php konnect-addon-manager/install.php --panel-root=/var/www/pterodactyl
php konnect-addon-manager/bin/manager.php --panel-root=/var/www/pterodactyl doctor
```

Run installation using the nonroot Panel file-owner identity that will run the
management worker, with permission to update the declared Panel destinations.
Ensure the web process can read the registry and submit queued operations to
private state. Use a shared nonroot deployment UID or a tested, explicitly
managed filesystem ACL policy for the web and worker identities. The manager
writes private directories/files with modes `0700`/`0600`; verify access to newly
created artifacts as well as existing files. A one-time parent-directory ACL
does not by itself establish that future private files are accessible. Do not
use `chmod 777` or broadly expose the Panel tree to solve ownership errors.
Keep the manager outside `addons/`. It backs up its small
bootstrap/navigation registration and uses private state under
`storage/app/konnect-addon-manager/`; never put this state in a served/public
storage directory. Repeat installation checks the existing registration rather
than adding duplicate sidebar entries. Do not replace compatibility
fingerprints simply to bypass an unsupported-source report.

Use `install.php --panel-root=/var/www/pterodactyl --dry-run` first to obtain the
source/preflight report without registration changes. You can pass
`--config=/absolute/path/host-settings.json` to merge runner settings and the
worker's `pollSeconds` and host `workerControl` settings at installation; JSON configuration cannot supply shell
commands or executable callbacks. After a failed initial registration, the
standalone `install.php --panel-root=/var/www/pterodactyl --recover-bootstrap`
restores verified registration backups. Lifecycle recovery uses the separate
`bin/manager.php recover` command below.

The manager page is `/admin/konnect-addons`, protected by the existing admin
session, two-factor requirement, root-admin check and CSRF protection. This
prebuilt page does not require rebuilding Panel's frontend. Keep the direct URL
available when diagnosing a theme navigation change.

## Configure validation and the worker

The initial manager page can be installed before an isolated runner is ready.
Addon activation remains blocked until doctor confirms a supported runner.
The default Docker runner requires a **rootless daemon owned by the nonroot
deployment account**. Rootful Docker socket access permits host-level actions
beyond Panel deployment privileges; it is not an appropriate default isolation
boundary for a web-facing application.
Configure the private `storage/app/konnect-addon-manager/host.json` runner entry
without removing the installer-detected host metadata:

```json
{
  "runner": {
    "mode": "docker",
    "dockerHost": "unix:///run/user/1001/docker.sock",
    "phpImage": "sha256:<immutable-local-image-id>",
    "nodeImage": "<reviewed-image-reference>@sha256:<digest>",
    "memory": "512m",
    "buildMemory": "2g",
    "cpus": 2,
    "timeout": 300
  }
}
```

This is a fragment to merge into the existing JSON, not a replacement file.
Replace `1001` with the deployment account's real UID and select its rootless
Unix socket owned by that account. Supported `dockerHost` paths are
`unix:///run/user/<numeric-uid>/docker.sock` and `unix:///var/run/docker.sock`;
remote endpoints and socket symlinks are rejected. The worker must
be able to reach that daemon under its supervised service environment. Supply
real immutable image IDs/digests with the matching PHP extensions and
Node/toolchain. The PHP image must already be available locally; the Node image
is required for native frontend builds. Mutable image tags are rejected.
Doctor checks actual runner capability, not just presence of a configuration
key, including the daemon's rootless capability and matching socket-owner UID.
The daemon must enforce CPU, memory and PID limits through delegated cgroups,
with Docker's built-in/default seccomp profile enabled. A rootless daemon
without those capabilities is blocked. Container UID 0 inside the rootless
user namespace maps to the nonroot host deployment account; it does not grant
host root. Containers use no network, a read-only root, dropped capabilities and
bounded resources. Staged source and controlled dependencies are mounted read-only for both PHP validation and Node builds; they do
not mount production `.env`, the live code tree writable or a Docker socket.
The dedicated manager worker controls the runner. Do not give addon code or an
HTTP endpoint generic Docker/shell privileges.

Frontend output is limited to a 128 MiB temporary in-memory filesystem.
The manager receives a bounded asset stream (at most 129 MiB), validates at
most 4096 files with at most 128 MiB total file bytes and 64 MiB per file, then
copies only verified `public/assets` outputs into staging. Builds that exceed
these limits fail without live activation.

PHP validation lints new or changed PHP relative to the immutable trusted
baseline. The baseline bytes/hashes are verified during composition;
unchanged baseline PHP is not all reparsed. Isolated fresh Panel boot,
declared handler/container checks and extension route checks still run, and
declared addon pages are compiled to PHP and linted. This prevents an existing,
lazily loaded vendor fault from being presented as a new addon change, but it
does not certify every retained baseline feature. Review known host advisories
and test the features your deployment uses.

**Never grant the web user access to a rootful Docker socket.** The optional
`"allowRootfulDaemon": true` runner setting exists only for a deliberate,
trusted deployment or development configuration whose operator accepts
host-level Docker privileges. It disables the default rootless-daemon
requirement; it does not remove the privilege boundary or make a rootful socket
safe for the web process. Keep any such socket access confined to the trusted
management worker and do not mount it in validation containers.

Run a dedicated management worker outside HTTP requests and the normal Panel
job queue:

```sh
php /var/www/pterodactyl/konnect-addon-manager/bin/manager.php --panel-root=/var/www/pterodactyl worker
```

An operator can run `worker --once` for one queued operation. Supervise the
long-running command with your service manager. A starting systemd template is:

```ini
[Unit]
Description=Konnect addon management worker
After=network.target

[Service]
Type=simple
User=YOUR_DEPLOYMENT_ACCOUNT
WorkingDirectory=/var/www/pterodactyl
ExecStart=/usr/bin/php /var/www/pterodactyl/konnect-addon-manager/bin/manager.php --panel-root=/var/www/pterodactyl worker
Restart=on-failure
RestartSec=5
TimeoutStopSec=600
UMask=0077

[Install]
WantedBy=multi-user.target
```

Adapt the PHP path, nonroot identity, private-state ownership and controlled
service/rootless-Docker permissions to the host. The worker needs to modify managed
Panel files; the web process needs the documented registry/queue access. Keep
the worker narrowly scoped and never run the web application as root. Set stop
and restart timeouts for builds and maintenance; interruption may require
journal recovery. Installing/enabling the operating-system service is an
operator action, not a generic sudo operation exposed by the manager UI.

Activation also requires host-owned service control. This candidate supports
`supervisor` groups for the affected ordinary queue workers, PHP-FPM processes
and any scheduled dispatcher. Configure a fragment such as:

```json
{
  "workerControl": {
    "driver": "supervisor",
    "binary": "/usr/bin/supervisorctl",
    "groups": ["pteroq", "panel-php-fpm", "panel-scheduler"]
  }
}
```

Replace group names with the groups you actually supervise. The manager checks
status, stops the configured groups, verifies stopped states before activation,
then starts them after a committed or verified restored state. Keep the
management worker outside these groups. Use a dedicated/scoped supervisor
control setup for these affected services. Include every persistent scheduler
process and its dispatched workers in the stopped groups. Independently invoked
cron tasks need an operator-configured maintenance gate and a procedure that
drains already running tasks before activation; the supervisor driver cannot
detect independent external cron work in flight. Do not treat its group-status
checks as proof that arbitrary scheduled work is quiescent. An ordinary
`queue:restart` signal alone does not prove old processes have drained. Hosts using only unsupported
service-control drivers remain blocked until a supported arrangement exists.

## Install and manage addon URLs

Use an author's public GitHub release ZIP asset or a tagged/commit-pinned
repository/folder URL. Branch/tree/archive refs are also accepted and resolved
to an immutable commit before download; prefer pinned sources when reviewing
updates. The manager resolves supported URLs, downloads one
archive, validates extraction and the strict package manifest, then freezes the
received bytes and source identity. Private sources and arbitrary hosts are
outside the initial URL contract. Never place credentials in a URL.

The admin page returns an operation ID immediately. Keep that ID when the page
temporarily loses contact during maintenance; reconnect to its persisted result
instead of submitting the same change again. A package can be structurally
valid yet blocked by dependencies, compatibility, source hashes, drift, missing
runner/build prerequisites or health checks. Read the operation details before
retrying.

| Action | Effect |
| --- | --- |
| Install | Validate/freeze a package and enable it after successful activation. |
| Update | Explicitly replace its version and revalidate its dependents. |
| Disable | Reconstruct without the addon; retain its package and database data. |
| Enable | Revalidate and compose the retained version with the enabled set. |
| Delete | Remove its code from composition; preserve database data and recovery-required package references. |

If other addons depend on the target, the operation identifies them. Review an
explicit cascade before accepting a combined disable/delete; it must not
silently remove unrelated addons. Disabling extension registrations stops
future dispatch but cannot undo completed requests, remote actions or work
already running. Confirm the configured worker/scheduler drain policy.

Checksums identify received bytes. Executable addons still run with Panel
application privileges after activation. Review the author and code; manifest
compliance does not make runtime addon code a sandbox.

## Backups, drift and recovery

The retained baseline captures the actual working installed source, including
preexisting manual customizations, excluding secrets and runtime data. Existing
manual addons are part of that baseline; they do not automatically become
individually manageable packages. The active inventory detects manual edits or
external upgrades before reconstruction. Stop and resolve such a report; do
not delete the baseline or reset hashes to make the operation pass.

Before activation for a migration pass, the worker requires the matching `mariadb-dump` or
`mysqldump` client and snapshots the full Panel database using the Panel's
database identity and host settings. It stores private
`storage/app/konnect-addon-manager/database-backups/<operation-id>.sql` bytes
with checksum metadata. Missing clients, unsupported database drivers or a
failed snapshot block schema changes. These backups contain application data;
protect them with the other private state and retain a tested off-host backup
and restore procedure. The single-transaction snapshot adapter requires all
Panel database tables to use InnoDB; other engines block schema-changing
operations until a separately tested backup strategy exists. Coordinate external
writers and concurrent schema changes in your recovery plan.
The manager does not run package-defined backup scripts or automatically
restore a dump during filesystem recovery.
Configured database TLS certificate/key files must be readable by the trusted
backup worker; the snapshot adapter requires server verification when TLS is
configured. Restore failures remain an operator recovery task.

Before a Panel/theme/pack upgrade, stop manager operations, back up the current
baseline/registry/packages/journals and database, test the new source adapter
and addon set on a copy, then follow a verified maintenance/rebase procedure.
This candidate has no automatic baseline-rebase command; an unsupported upgrade
remains blocked until that procedure and adapter are supplied. Keep the
previous recovery checkpoint.

Filesystem activation uses per-file renames while the panel is in maintenance;
it is not atomic across the whole tree. After a process interruption, stop the
manager worker and keep maintenance active. Standalone recovery does not need
to boot potentially modified Laravel code:

```sh
php /var/www/pterodactyl/konnect-addon-manager/bin/manager.php --panel-root=/var/www/pterodactyl recover
php /var/www/pterodactyl/konnect-addon-manager/bin/manager.php --panel-root=/var/www/pterodactyl recover --operation=OPERATION_ID
php /var/www/pterodactyl/konnect-addon-manager/bin/manager.php --panel-root=/var/www/pterodactyl doctor
```

Inspect recovery and doctor results before reopening the panel or restarting
normal work. Do not run a global Laravel `migrate:rollback` to remove one addon.
Additive database DDL may have committed even when code activation failed.
Disable/delete preserves schema and data; code rollback does not reverse data,
remote actions or a committed DDL operation. If old code is incompatible with
the resulting schema or the recovery report is uncertain, keep maintenance
enabled and use the tested database recovery plan.

## Verify a target server

Use a disposable copy of the exact upgraded installation to exercise initial
installation twice, URL installation, basic/dependent/conflicting examples,
update/disable/enable/delete, interrupted activation and recovery. Verify admin
and client login, server console, existing Arix/Pack features, permission and
CSRF denial, migration data retention and normal queue/scheduler behavior after
each change. The repository's automated fixture results are useful development
evidence; live/browser validation and your exact version/source match remain
required before a production support claim.
