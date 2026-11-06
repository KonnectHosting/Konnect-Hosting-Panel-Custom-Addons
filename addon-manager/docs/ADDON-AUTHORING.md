# Addon authoring quick start

Use this guide to commission an addon, assemble its deployment folder and publish
a GitHub link that Addon Manager can install. Give another coding chat the
[copy-and-paste brief](AI-ADDON-BRIEF.md) and describe the feature you want.

This guide describes **manager 2.0.1, manifest version 1**, checked against
manager source commit `5a899b28aa80b08f3ab8a5cbae3e5315cc5c2563`.
Use the SDK matching the manager actually installed on the destination server.

## 1. Choose a supported integration

| Feature | Contract in this release |
| --- | --- |
| Admin page, menu and HTTP handler | Declarative `extensions.pages`, `menus` and `routes`; root administrators only |
| Event listener, scheduled task or queued job | Declarative `events`, `schedules` and `jobs`; use the manager's guarded dispatch |
| New PHP, Blade and static assets | Declare each source, destination and SHA-256 in `files` |
| Change an existing supported file | Exact fragment patch with the correct owner; test the actual host source |
| Database tables and columns | JSON additive migrations on addon-owned tables; data retained on disable/delete |
| Native Panel frontend change | Declared new source files and/or exact patches, plus `build.mode: panel`, profile `panel-v1` |
| Customer/server tabs, public routes or a React component registry | No built-in manifest API; additional integration work must be designed and tested |
| Dependency installation or custom shell installer | Unsupported package operation |

The complete contracts are the [schema](../schemas/addon.schema.json),
[runtime validator](../src/Core/ManifestValidator.php),
[path protections](../src/Core/Paths.php), and [developer reference](DEVELOPER.md).
Unknown JSON fields are rejected. Do not invent `install.sh` hooks, service
providers, client permissions or build commands that the SDK does not accept.

The measured host adapters in 2.0.1 cover Panel **1.15.1**, with optional Arix
**2.1.3** and Addon Pack **2.0.2** variants. A manifest claiming `=1.15.2` does not
add a 1.15.2 host adapter. An Arix installation displaying 1.15.1 after an update
does not establish which upstream fixes its files contain. Verify the actual
source before claiming compatibility.

## 2. Keep the deployment package separate

A dedicated addon repository can use this layout:

```text
my-addon-repository/
  addon/
    manifest.json
    README.md
    payload/
      index.blade.php
      StatusController.php       # only if declared
      app.js                     # only if declared
    patches/                     # only declared find/replace fragments
    database/                    # only declared JSON migrations
  tests/
  tools/
  .github/workflows/
  dist/                          # generated ZIP and checksum
```

Only `addon/` is exported. Keep tests, build tooling, dependency folders, GitHub
workflows and the manager SDK checkout outside it. The only undeclared metadata
files permitted at the package root are `README`, `README.md`, `README.txt`,
`LICENSE`, `LICENSE.md` and `LICENSE.txt`; every other file must be declared.
Do not put a developer guide or release notes inside the deployment folder
unless they are permitted root metadata or actual declared payloads.

For a first addon, copy the existing
[basic admin example](../sdk/examples/basic-admin-page/) to a new, absent `addon/`
directory in your addon repository. For example:

```sh
cp -R /path/to/manager-repository/addon-manager/sdk/examples/basic-admin-page addon
```

Choose a new stable ID such as `mycompany.status`, change the display name and
use your own destination namespace, for example:

```text
app/Addons/MyCompanyStatus/StatusController.php
resources/views/addons/mycompany_status/index.blade.php
public/addons/mycompany_status/1.0.0/app.js
```

Do not copy the manager itself into an addon. Addons are not installed by copying
their package folders into the live Panel's protected `addons/` directory.

## 3. Write the manifest against the example

This compact manifest uses the existing SDK example's unmodified Blade payload
and its real checksum. It is a scaffold, not a compatibility claim for a new
feature or a 1.15.2 server:

```json
{
  "manifestVersion": 1,
  "id": "example.demo",
  "name": "Addon Demo",
  "version": "1.0.0",
  "compatibility": {
    "manager": "^2.0",
    "php": ">=8.2 <9.0",
    "panel": "=1.15.1"
  },
  "files": [{
    "source": "payload/index.blade.php",
    "target": "resources/views/addons/example_demo/index.blade.php",
    "sha256": "b52b8d947f59b3d0cd48c05cf7f54aa8ac497678f3e4238002adb03b0887420b"
  }],
  "extensions": {
    "pages": [{
      "id": "status",
      "path": "status",
      "title": "Addon Demo",
      "view": "addons.example_demo.index",
      "permission": "admin"
    }],
    "menus": [{ "id": "demo-menu", "label": "Addon Demo", "page": "status" }]
  },
  "database": { "dataPolicy": "preserve", "migrations": [] },
  "build": { "mode": "none" }
}
```

On a supported, fully configured host, this example's page is:

```text
/admin/addon-manager/extensions/example.demo/status
```

When changing the scaffold, keep these relationships consistent:

- Stable addon ID: lowercase letters/digits with dot or hyphen separators.
  Keep it for future updates; increment the semantic `version` for changed releases.
- View `addons.mycompany_status.index` maps exactly to the declared destination
  `resources/views/addons/mycompany_status/index.blade.php`.
- Handler `Pterodactyl\Addons\MyCompanyStatus\StatusController@index` maps to
  declared `app/Addons/MyCompanyStatus/StatusController.php`. In JSON, escape each
  backslash as `\\`.
- Extension IDs must be unique across pages, menus, routes, events, jobs and
  schedules. A menu's `page` references a page ID in the same addon.
- Endpoint paths are lowercase literal paths such as `api/status`, with no
  leading/trailing slash, `{parameters}` or query string in the declaration.
- Pages and routes use `permission: "admin"`; events, schedules and jobs use
  `"system"`. These are the supported values, not configurable role names.
- Omit `compatibility.arix` and `addonPack` for independent packages. Declare and
  test them when the addon actually requires those products. Do not add Arix
  dependencies to an addon intended for stock Panel.

`files` creates new destinations. It cannot overwrite a baseline file or another
addon's destination; use a supported exact patch for an existing file. An update
can retain the same paths owned by its previous version through reconstruction.

For every changed payload, calculate the hash after finishing the edit/build:

```sh
sha256sum addon/payload/index.blade.php
```

Put that result in the corresponding `files[].sha256`. Patch hashes cover the
exact find/replace fragment bytes, including final newlines. Migration hashes
cover their JSON bytes. The exporter deliberately does not refresh hashes.
Review bytes before updating declarations; never change installed ledger hashes
to conceal live drift.

## 4. Respect ownership, data and build rules

- Dependencies use `dependencies: [{"id":"other.addon","version":"^1.0"}]`.
  Conflicts use the `incompatible` array with the same shape. Dependency packages
  must already be available; the manager does not download dependency URLs.
- Patching another addon requires `owner: "addon:other.addon"` and that declared
  dependency. Other owners are `panel`, `arix` and `baseline`. An Arix-owned patch
  also requires an Arix compatibility constraint. Each find fragment must match
  exactly once; independent overlapping edits conflict. See the
  [dependency example](../sdk/examples/dependency-banner/manifest.json).
- Dependency metadata alone is not permission to overwrite files with `files`.
- Protected targets include the manager, bootstrap/auth registrations, dependency
  manifests/lockfiles, runtime storage and Arix licensing/controller internals.
  `Paths.php` is authoritative. Do not weaken it for a package.
- Runtime application data can be written through normal authorized Laravel
  services. Runtime storage is not deployment payload; do not distribute live
  data, `.env`, credentials or application database dumps.
- Migrations are JSON `createTable`, `addColumns` or non-unique `createIndex`
  operations. Use namespaced tables such as `mycompany_status_settings`.
  Existing migrations are immutable; add a new ID/file for a new change.
  No executable migration PHP, arbitrary SQL, destructive operations or
  `unique: true` indexes pass the 2.0.1 package validator. A new table may declare
  a primary key. Disable/delete retains schema and data.
- Addon code must continue to work with retained data after disable/re-enable and
  with old compatible code after rollback. Migration backups need a real restore
  strategy; code rollback does not undo database DDL or remote actions.
- `build: {"mode":"none"}` supports declared standalone static assets and Blade.
  It does not inject a bundle into the existing React app.
- Native Panel frontend edits require declared new source files and/or exact
  patches to existing files, plus
  `{"mode":"panel","profile":"panel-v1","outputs":["public/assets"]}`.
  The host must have the measured toolchain and frozen dependencies. Packages
  cannot run arbitrary build commands, `yarn add`, npm installs or Composer changes.
- Use [guarded jobs](DEVELOPER.md#registered-extensions), not serialized raw addon
  classes in long-lived queues. Supported schedule frequencies are `everyMinute`,
  `hourly` and `daily`.

Addon PHP has Panel application privileges after activation. Validate input,
authorize access to server/user data, preserve CSRF and escape displayed content.
Package validation is not a runtime security sandbox.

## 5. Validate and export on a development machine

These commands require PHP 8.2+ with ext-zip and the matching manager SDK. They do
not require a live Panel, Laravel, Docker or a database just to validate/export.
Run from the addon repository, where `_manager/` is a checkout of this manager
repository and `addon/` is your clean deployment package:

```sh
php _manager/addon-manager/sdk/bin/addon.php validate addon
mkdir -p dist
php _manager/addon-manager/sdk/bin/addon.php export addon --output=dist/my-addon-1.0.0.zip
(cd dist && sha256sum -c my-addon-1.0.0.zip.sha256)
unzip -l dist/my-addon-1.0.0.zip
```

Use an output filename that does not already exist; neither the ZIP nor its
sidecar can be overwritten. Export outside `addon/`. SDK export checks the
package, creates a deterministic ZIP and round-trip validates extraction. Its
ZIP has `manifest.json` at the root.

SDK success does not prove the host has the right adapter, dependency versions,
patch matches, framework APIs or operational prerequisites. Test on a disposable
copy of the exact intended Panel/Arix installation:

1. Install and exercise the feature and permissions.
2. Update the same addon ID; verify data and dependent addons.
3. Disable, re-enable and delete; verify surviving addons and retained data.
4. Test declared conflicts, missing dependencies and changed patch targets.
5. Exercise relevant builds, migration failures and recovery without claiming
   unrun checks passed.

## 6. Publish a link the manager accepts

Preferred: publish the SDK-generated ZIP and `.sha256` as assets of a **public
GitHub release**, then paste the ZIP URL into the manager's Install dialog:

```text
https://github.com/YOUR_ORG/YOUR_ADDON/releases/download/v1.0.0/my-addon-1.0.0.zip
```

The checksum sidecar is for independent verification; the importer records its
own archive digest and does not fetch that sidecar. Attach the actual exported
ZIP, not a text file containing a download URL. GitHub Actions workflow artifacts
requiring a login are not a substitute for public release assets.

For a self-contained folder inside a public repository, use:

```text
https://github.com/YOUR_ORG/YOUR_ADDON/tree/FULL_40_CHARACTER_COMMIT/addon
```

GitHub has no standard single-folder ZIP URL. The manager downloads a repository
archive and selects the named folder. A root commit/archive URL will not search
for a nested `addon/manifest.json`. Branch/tree refs are accepted and resolved
to an immutable commit; prefer reviewed tags/commits for updates. Download limits
apply to the whole fetched archive: keep a publishing repository small. Current
defaults cap the archive at 64 MiB and expanded archive data at 256 MiB, before
selecting a package subfolder. Archive path and link checks also apply before
that selection, so unrelated repository files can make a folder import fail.

Private repositories, raw.githubusercontent.com URLs, arbitrary hosts, credentials
in URLs, bare repository URLs and release-page URLs are not accepted install
inputs in 2.0.1. An authenticated GitHub tool being able to push a private repo
does not grant the manager access. Keep private development material private;
publish only reviewed deployable packages in a suitable public release repository.
Anyone who can download that public package can read its addon code.

Use the [CI workflow template](../sdk/ci/export-addon.yml) if desired. Replace
`YOUR_ORG/addon-manager` with the actual manager repository and pin a reviewed full
commit. Its `_manager/addon-manager/sdk/bin/addon.php` path assumes this repository's
layout. CI publishing is separate from installing the addon on a live server.
The template publishes a release in its own repository. For private development
with a separate public release repository, adapt that publishing step with
authorized access to the explicit release target; do not assume a private
repository's release assets become public.

The live manager still needs a working dedicated worker, isolated runner,
supported service control and a matching source adapter. In 2.0.1, activation
service control supports Supervisor; systemd support is not supplied by changing
a JSON field. Authoring a valid addon does not complete that host setup.
