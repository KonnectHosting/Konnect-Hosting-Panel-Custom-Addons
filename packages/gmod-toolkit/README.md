# GMod Toolkit 1.2.0

A single Panel addon: install through the existing Addon Manager dialog, then
use the separate FastDL and Workshop server pages. It needs **no node changes or companion
installation**. GMod eggs are recognized automatically. The manager's native
frontend build and existing Wings/queue integrations do the work.

## Install through the Panel

Paste this URL into **Addon Manager → Install addon → GitHub package URL**:

```text
https://github.com/KonnectHosting/Konnect-Hosting-Panel-Custom-Addons/tree/164aadb9d6235566dc7de1b34e96788ed901f49a
```

This immutable publication contains only the deployable addon at its root.
The development source remains in packages/gmod-toolkit/addon on the PR branch.
Wait for the manager to finish activation. No files need copying into /root,
no SSH commands need running, and no node provisioning step follows install.

The optional downloadable SDK archive is `dist/gmod-toolkit-1.2.0.zip` with its
`.sha256` sidecar. It contains manifest.json at its root. The manager dialog uses
the **package URL above**, rather than a GitHub blob/raw ZIP URL. Updates
use **GMod Toolkit → Update**, the same addon ID `gmod.toolkit` and this version's immutable package URL.
Keep the existing private state; the manager reconstructs source and retains data.

On Arix, remove the old GMod Toolkit sidebar entry. From **Missing Links**, add
**FastDL** (`/fastdl`) and **Workshop** (`/workshop`) to your conditional Garry's
Mod category and save. The old `/gmod-toolkit` URL redirects to Workshop.

Version 1.2.0 publishes only explicitly uploaded assets from
`/home/container/fastdl/`. The customer FastDL page can create the upload folders
through the existing Wings file connection. Game directories are left alone.
FastDL and Workshop have independent pages and status requests; the mounting
explanation and Startup link have been removed.

## Customer tools

- **Workshop:** collection IDs/links, recursive nested collections, duplicate and
  cycle removal, GMod app validation, item/Lua previews, private backups, previewed
  restoration and stale-edit rejection. No Steam credentials enter Lua or FastDL.
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

Open **FastDL → Prepare upload folders**, then upload extracted assets using
Files/SFTP under the container's `fastdl/` directory:

```text
/home/container/fastdl/maps/
/home/container/fastdl/materials/
/home/container/fastdl/models/
/home/container/fastdl/sound/
/home/container/fastdl/particles/
/home/container/fastdl/resource/fonts/
```

Keep game-relative names: `fastdl/maps/rp_example.bsp` is published at
`<your-download-url>/maps/rp_example.bsp`. Compression is automatic. Preview the
uploaded files, review the changes, then publish. The unique URL appears after
the first successful publication, with copy buttons for the URL and settings
for `/garrysmod/cfg/server.cfg`. Restart the game server or apply the settings
in its console. Repeat preview/publication after changing uploads.

Updating preserves previous publications, their URLs and Workshop backups.
Unfinished previews prepared from the old game directory are retired so a new
preview always uses `fastdl/`. Existing game files are never moved or scanned.

Only approved game assets are public. The addon never aliases /home/container,
serves game files on demand, exposes Lua/cfg/archives, or installs a web server in
a game container. Server file reads use the existing server-bound Wings API;
reported links and changed metadata are rejected and transfer lengths are bounded.
Wings remains responsible for its own filesystem containment. A hash-checked
private snapshot is the object the customer previews and approves.

## Isolated validation compatibility

Version 1.2.0 has no registered scheduler hook. Authorized status polling resumes
only that server's interrupted work, with throttling and fresh worker permission
checks. This avoids an installed 2.0.1 probe bug: resolving the host scheduler
starts telemetry registration, which queries a settings table absent from the
empty validation database. The addon installs with the unchanged probe; no live
DB changes, manager hotfix or node changes are required.

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
numbers reject duplicate work; authorized server-status polling recovers interrupted
steps and cleans expired previews when the tool is opened. Failed publication preserves the old snapshot.

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
  --output=packages/gmod-toolkit/dist/gmod-toolkit-1.2.0.zip
(cd packages/gmod-toolkit/dist && sha256sum -c gmod-toolkit-1.2.0.zip.sha256)
```

The original deployed probe is covered by an executable regression (a full Git
checkout provides the pinned 2.0.1 probe source):

```sh
python3 packages/gmod-toolkit/tests/isolated-probe.py --vendor=/path/to/disposable-panel/vendor
```

This boots the real candidate with an empty SQLite database, no network,
read-only source/dependencies and no telemetry override. It verifies handler,
route and view checks complete using the unchanged installed probe.
