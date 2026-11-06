# GMod Toolkit 1.1.0

A single Panel addon: install through the existing Addon Manager dialog, then
use the GMod Toolkit server tab. It needs **no node changes or companion
installation**. GMod eggs are recognized automatically. The manager's native
frontend build and existing Wings/queue/scheduler integrations do the work.

## Install through the Panel

Paste this URL into **Addon Manager → Install addon → GitHub package URL**:

```text
https://github.com/KonnectHosting/Konnect-Hosting-Panel-Custom-Addons/tree/a30dfdfd7089db3eaf5c740709fb5cd82686da95
```

This immutable publication contains only the deployable addon at its root.
The development source remains in packages/gmod-toolkit/addon on the PR branch.
Wait for the manager to finish activation. No files need copying into /root,
no SSH commands need running, and no node provisioning step follows install.

The optional downloadable SDK archive is `dist/gmod-toolkit-1.1.0.zip` with its
`.sha256` sidecar. It contains manifest.json at its root. The manager dialog uses
the **package URL above**, rather than a GitHub blob/raw ZIP URL. Updates
use the same addon ID `gmod.toolkit` and the next version's immutable package URL.
Keep the existing private state; the manager reconstructs source and retains data.

## Customer tools

- **Workshop:** collection IDs/links, recursive nested collections, duplicate and
  cycle removal, GMod app validation, item/Lua previews, private backups, previewed
  restoration and stale-edit rejection. Server mounting remains a separate
  existing Startup operation; no Steam credentials enter Lua or FastDL.
- **FastDL:** private snapshots copied through Wings; asynchronous progress;
  exact added/changed/removed previews; `.bz2` compression and raw fallback;
  complete-generation publication; random URLs with rotate/revoke controls.
- **Permissions:** actual server membership and file permissions, CSRF, two-factor,
  fresh authorization in queued work, and public download guards for enabled
  addons, eligible eggs and active servers.

FastDL uses the **Panel's hostname**, for example:

```text
https://panel.example.com/fastdl/<random-64-hex-token>/
```

The server UUID identifies server state internally and is never a public root.
Customers copy the generated `sv_downloadurl` setting into server.cfg. A stopped
GMod process does not interrupt published downloads. The node FQDN is not used:
serving custom HTTP paths there would require changes the node owner controls.

Only approved game assets are public. The addon never aliases /home/container,
serves game files on demand, exposes Lua/cfg/archives, or installs a web server in
a game container. Server file reads use the existing server-bound Wings API;
reported links and changed metadata are rejected and transfer lengths are bounded.
Wings remains responsible for its own filesystem containment. A hash-checked
private snapshot is the object the customer previews and approves.

## Runtime and lifecycle

Targets Addon Manager **2.0.1**, Panel **1.15.1**, PHP **8.2/8.3**, with optional
Arix. The Panel's existing Python 3 runtime provides standard-library bzip2;
its small compression helper is declared in this addon. No extra worker/service,
root installer, API credential or package-manager hook is supplied or needed.

The Panel stores private state in storage/app/gmod-toolkit, outside public roots.
It pays the disk/bandwidth cost of FastDL. Limits and detailed behavior are in
[addon/README.md](addon/README.md). Public asset routes disappear on disable/delete,
and their enabled-version guard rejects stale routing. Server suspension,
deletion, egg disabling, URL rotation and revocation also deny downloads. Data is
retained for re-enable/update. Already-downloaded assets cannot be recalled.

Queue work uses manager-guarded registrations and small JSON payloads. One step
scans one directory, copies one file or compresses one file, within the existing
worker timeout. Fresh actor permissions are checked at execution. Sequence
numbers reject duplicate work; a guarded scheduled recovery retries interrupted
steps and cleans expired previews. Failed publication preserves the old snapshot.

## Development

Keep tests/tooling outside addon/. Validate with the matching SDK:

```sh
php addon-manager/sdk/bin/addon.php validate packages/gmod-toolkit/addon
php packages/gmod-toolkit/tests/package.php
python3 packages/gmod-toolkit/tools/fixture.py /tmp/gmod-panel-test
cd /tmp/gmod-panel-test
composer install --no-dev --no-scripts --no-plugins --prefer-dist
cd /path/to/this/repository
GMOD_TOOLKIT_DISPOSABLE=1 php packages/gmod-toolkit/tests/panel.php /tmp/gmod-panel-test
```

The Panel suite uses actual locked Laravel dependencies, synthetic server/user
models, SQLite, fake Wings/Steam transports and real local bzip2 compression.
It exercises the real anonymous HTTP download route and manager-guarded jobs.
No production server is contacted. Package lifecycle tests use explicit fixture
build/verifier callbacks. See [VERIFICATION.md](VERIFICATION.md) for their limits.

`fixture.py --frontend-only` prepares a native frontend for TypeScript, targeted
ESLint and the production build. `--variant arix`/`arix-pack` additionally need
the theme's matched frozen dependencies; the addon installs no dependencies.
After reviewing source, refresh hashes with tools/manifest.py, then export to an
absent output filename:

```sh
python3 packages/gmod-toolkit/tools/manifest.py
php addon-manager/sdk/bin/addon.php export packages/gmod-toolkit/addon \
  --output=packages/gmod-toolkit/dist/gmod-toolkit-1.1.0.zip
(cd packages/gmod-toolkit/dist && sha256sum -c gmod-toolkit-1.1.0.zip.sha256)
```
