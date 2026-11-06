# Developing an addon

For a first package, use the [authoring quick start](ADDON-AUTHORING.md).
To commission work in another coding chat, copy the
[addon development brief](AI-ADDON-BRIEF.md).

Manifest version 1 packages are folders containing `manifest.json` and explicitly declared
payload bytes. They are data contracts, with no install/uninstall shell scripts,
arbitrary SQL, executable migrations or package-manager hooks. Addon PHP that
runs after activation has application privileges and must be trusted.

Use the SDK from a fresh matching manager distribution. Manager 2.0.1 uses the
`AddonManager` PHP namespace and `/admin/addon-manager` URLs. Earlier manager
registration and active state are refused rather than migrated automatically;
read [the upgrade guide](UPGRADING.md) before replacing an existing installation.
Packages supporting only manager 1.x are refused. Review their PHP/API references
before declaring manager 2.x compatibility; changing a range alone does not make
their executable code compatible.

The authoritative machine contract is
[`schemas/addon.schema.json`](../schemas/addon.schema.json), supplemented by the
core validator's path, ownership and payload checks. Unknown fields and
unsupported modes fail validation. Use the matching SDK rather than assuming
schema validation alone proves the folder deployable.

## Identity and compatibility

Required fields are `manifestVersion: 1`, a stable `id`, display `name`, semantic
`version`, and `compatibility` containing manager, PHP and Panel constraints.
`arix` and `addonPack` constraints are optional. Omitted relationships, files,
patches and extension lists are empty; database defaults to preserved data and
no migrations; build defaults to `none`. Example constraints are `^2.0`,
`>=8.2 <9.0`, and `=1.15.1`. Source adapter checks remain necessary even when a
version string matches. A version constraint is an author's supported range,
not evidence the manager has tested that host.

`dependencies` and `incompatible` contain `{ "id": "other.addon", "version":
"=1.0.0" }` entries. Dependencies must already be available in the requested
enabled set. The manager does not infer or download a dependency URL. Cycles,
missing versions and incompatible combinations block composition. Updating a
dependency revalidates enabled dependents before touching live code.

## Files and exact patches

Each `files` entry has package-relative `source`, Panel-relative `target`, and
`sha256` of the source bytes. A file declaration owns its destination. Avoid
generic targets shared with other addons; use a namespace such as
`app/Addons/YourAddon/` and `resources/views/addons/your_addon/`.

Every payload file must be declared as a file source, a patch fragment or a
migration source. Only root `manifest.json`, `README`, `README.md`, `README.txt`,
`LICENSE`, `LICENSE.md` and `LICENSE.txt` may be undeclared metadata. Do not ship
`.env`, credentials, runtime storage, manager code, vendor/node_modules or PHP
under public paths. Symlinks and unsafe or ambiguous paths are rejected.
Manager/bootstrap registration, Panel admin/auth route files, and the host's
admin authentication, two-factor and CSRF middleware are protected.
The Arix admin controller/middleware trees and protected Arix auth, helper and
configuration files also cannot be copied or patched by an addon. The core path
validator contains the authoritative protected-path list.

Patches identify the exact owner and the unique fragment they change:

```json
{
  "id": "replace-demo-message",
  "target": "resources/views/addons/example_demo/index.blade.php",
  "owner": "addon:example.demo",
  "find": "patches/find.txt",
  "replace": "patches/replace.txt",
  "beforeSha256": "<SHA-256 of find.txt bytes>",
  "afterSha256": "<SHA-256 of replace.txt bytes>"
}
```

`find` and `replace` are UTF-8 fragment files. Their hashes cover the exact
fragment bytes, including whitespace; lifecycle records whole-file hashes in
its ledger. A patch to `addon:<id>` requires a matching declared dependency on
that addon. Other owner values are `panel`, `arix` and `baseline`. There must be
exactly one match; no fuzzy matching or line-number-only patches are supported.
Independent nonoverlapping patches can coexist; overlapping independent edits
are conflicts. Patching obfuscated licensing/controller internals is outside
the supported scope.

Disabling or deleting a patching addon reconstructs the desired enabled set
from the retained baseline and frozen packages. It does not restore an old whole
file over surviving addon changes. Manually changing live managed files blocks
reconstruction until an operator resolves the drift.

## Registered extensions

Pages and routes are rooted at
`/admin/addon-manager/extensions/<addonId>/`. Manifest version 1 uses admin permissions; client
pages, embedded React components, server tabs, dashboard bridges and arbitrary
frontend integration are not a promised runtime API in this candidate.

```json
{
  "pages": [{
    "id": "status", "path": "status", "title": "My addon",
    "view": "addons.my_addon.index", "permission": "admin"
  }],
  "menus": [{ "id": "my-menu", "label": "My addon", "page": "status" }],
  "routes": [{
    "id": "read-status", "path": "api/status", "method": "GET",
    "handler": "Pterodactyl\\Addons\\MyAddon\\StatusController@index",
    "permission": "admin"
  }]
}
```

The view must be a declared `resources/views/addons/my_addon/index.blade.php`
target. Handler classes must be declared under `app/Addons/` with namespace
`Pterodactyl\Addons\...`; use the Panel's existing authorization for any data
you access. Menu `page` references a page ID in the same addon. The provider uses
the existing web session, CSRF, two-factor and root-admin middleware. Requests
check enabled addon/version state before loading the declared handler.

Management API clients posting to `/admin/addon-manager/api/operations` must
also send `X-Addon-Manager-Actor` with the authenticated administrator's exact
decimal ID, in addition to the session and CSRF token. A missing or mismatched
header is rejected before enqueue. Preserve the same `requestId` after an
uncertain response; a changed account must not replay another account's pending
request. The bundled manager UI implements this contract.

Event declarations have `id`, event class `event`, `handler` in `Class@method`
form and `permission: "system"`. Schedule declarations have `id`, `handler`,
`frequency` (`everyMinute`, `hourly`, `daily`) and `permission: "system"`.
Event handlers receive the event instance as `event` and the dispatch arguments
as `payload`; schedules use Laravel's container to call the declared handler.
Disabling removes future registrations; it cannot undo work already performed.

Declare jobs using the same file/handler mapping:

```json
{
  "jobs": [{
    "id": "refresh-summary",
    "handler": "Pterodactyl\\Addons\\MyAddon\\RefreshSummary@handle",
    "permission": "system"
  }]
}
```

Inject `AddonManager\Laravel\ExtensionRegistry` into your declared
handler and dispatch plain data through the manager:

```php
$extensions->dispatchJob('my.addon', '1.0.0', 'refresh-summary', ['serverId' => 123]);
```

The manager queues its own `AddonJob` wrapper containing only addon ID, exact
version, job ID and plain JSON payload. The job handler receives `payload`.
Payloads are bounded to 64 KiB and 20 levels of nesting; objects/resources are
rejected. Execution skips disabled addons and stale versions before loading the
addon class; jobs encountered during maintenance are released for retry after
15 seconds. Use the Panel queue's appropriate retry/timeout policy for this
wrapper (its worker timeout is 60 seconds). Do not serialize raw addon classes
to long-lived queues. Custom installer hooks and undeclared job types remain
unsupported.

## Frontend and build modes

Use `build: { "mode": "none" }` for standalone pages with declared prebuilt
assets. Public assets may be static files only. Reference versioned assets from
the Blade view and keep them within your addon namespace. The basic example
uses no JavaScript and needs no host rebuild.

Native Panel source changes require the manager-owned build profile:

```json
{ "mode": "panel", "profile": "panel-v1", "outputs": ["public/assets"] }
```

Outputs must be declared directories under `public/assets`. The matching host's
lockfile and toolchain must be available; the measured fixtures require Node 22
and their frozen dependency set, including any dependencies required by the
working theme. Missing dependencies block builds. Staged source and dependencies
are read-only for both PHP validation and Node builds. The runner permits
frontend writes only to a 128 MiB asset tmpfs and accepts a streamed receipt of
at most 129 MiB, with at most 4096 files, 128 MiB total file bytes and 64 MiB per
file. Generated paths and asset-manifest integrity mappings are verified before
copying outputs into staging. These rootless Docker builds record outputs as
shared composition outputs. This does not provide an
arbitrary `npm install`, `yarn add` or Composer mutation mechanism. A standalone
bundle cannot silently replace an already-compiled React component. Unsupported
bridge/build profiles block activation; test the exact composition before
claiming support.

The isolated PHP probe lints new/changed PHP against the immutable trusted
baseline inventory; unchanged baseline PHP is skipped by the syntax pass.
Composition verifies retained baseline hashes, and the probe still boots Panel
fresh with synthetic configuration, resolves declared handlers and checks
extension routes. Declared addon views are compiled and their PHP is linted.
These checks do not establish that every lazy-loaded baseline controller works.
The measured Arix installer-delivery preset controller has a preexisting PHP
8.2+ parse fault and remains unchanged; fixing that vendor feature requires a
vendor correction and a newly supported source adapter, not an addon patch or
license/obfuscation bypass.

## Additive database declarations

Database data is preserved on disable/delete. Declare JSON migration payloads:

```json
{
  "dataPolicy": "preserve",
  "migrations": [{
    "id": "create-settings", "source": "database/create-settings.json",
    "sha256": "<SHA-256 of the JSON payload>"
  }]
}
```

The JSON payload contains `operations`. Supported types are `createTable`,
`addColumns` and `createIndex`, applied only to addon-owned namespaced tables.
The namespace is the addon ID with dots/hyphens changed to underscores followed
by `_`, for example `example_demo_settings`. Columns use `name`, `type` and
optional `nullable`, `default`, `length`; supported types are `string`, `text`,
`integer`, `bigInteger`, `boolean`, `timestamp` and `json`. `createTable` may
declare `primary`; `createIndex` includes `name`, `columns` and optional
`unique: false`. The 2.0.1 package validator rejects every `unique: true` index,
including one on a table created in the same migration. A new `createTable`
declaration may include a primary key. Do not infer package support from a
lower-level database executor accepting a broader operation.
The executor validates source checksums and immutable migration IDs.
Defaults must match boolean, integer or string column types; `null` is allowed
only for nullable columns. Text, timestamp and JSON defaults are unsupported.
String lengths are bounded to 1–1024. `addColumns` requires `nullable: true` or
an explicit supported, non-null primitive default so old-version inserts remain
valid after code rollback. `createTable` may use required columns because older
addon code did not know the new table.

No drop, rename, arbitrary PHP/SQL or destructive data transformations are
allowed. MySQL DDL can commit implicitly: filesystem rollback cannot reverse
it. Keep migrations additive and old-code compatible, and require a usable
database backup/recovery strategy before production schema changes. The worker
requires a matching MySQL/MariaDB dump client and creates a checksummed,
private full-Panel database snapshot before activation for its migration pass.
All existing tables must use InnoDB for this single-transaction backup adapter.
Other engines or database drivers block packages with migrations until a tested
backup adapter exists. A snapshot
does not prove restore readiness; operators must test their recovery procedure.

## Export and publish

Build assets in your development/CI repository, assemble a clean package folder,
calculate reviewed file and fragment checksums, then run SDK validation/export.
The exporter refuses undeclared files and never updates hashes. Publish the ZIP
and `.sha256` sidecar as GitHub release assets. The sidecar helps operators
compare bytes; the manager records its own received-archive digest.

Use a release URL or tagged/commit-pinned folder URL. A folder URL causes a
repository archive download followed by extraction of the named directory;
GitHub has no standard single-folder ZIP endpoint. Keep the manifest and its
payload self-contained inside that directory. Branch/tree/archive refs are also
accepted: the resolver converts them to an immutable commit before downloading
and records that identity. Prefer release or commit-pinned URLs for reviewable
updates. Private repositories and arbitrary download hosts are unsupported.
The manager freezes installed bytes; reconstruction never refetches a branch.

Validate the basic/dependent/conflicting examples, runtime extension behavior,
disable/delete restoration, dependency updates, builds, migration failures and
recovery on your exact host fixture. A package passing the exporter alone is
not a production compatibility result.
