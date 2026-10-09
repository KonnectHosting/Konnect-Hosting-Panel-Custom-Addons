# Addon Manager development plan

Status: the implementation is complete as a development candidate; the
neutral distribution is Addon Manager 2.0.0. This document preserves the design
and acceptance criteria. Manifest format version 1 remains supported; manager
2.0.0 is a breaking API release and requires matching package compatibility.
The [administrator guide](../../addon-manager/docs/ADMINISTRATOR.md),
[developer guide](../../addon-manager/docs/DEVELOPER.md), and
[verification record](../../addon-manager/docs/VERIFICATION.md) define the
implemented contract, tested fixtures, and remaining production limitations.

## 1. Product and compatibility target

Deliver one folder, `addon-manager/`, that can be copied or downloaded
into an existing, working Pterodactyl panel and installed with one initial PHP
command. After that, administrators install addons from GitHub links through the
panel without FTP, uploading the full repository, or manually placing files.

The manager supports measured stock Panel v1.15.1 sources. Arix Theme v2.1.3
and Addon Pack v2.0.2 are optional fixture profiles, not prerequisites. These
fixtures are not proof of a server's versions or installed source. Other
versions need tested adapters. The initial installer detects the real server
configuration and selects a supported source adapter; an unknown version or
unexpected source fingerprint stops installation with a useful report.

The repository's Arix and Addon Pack payloads remain under version folders;
their presence does not mean the theme and pack have been activated. Capture
the baseline from the functioning installed source, with any intended theme
and pack already activated. Do not reconstruct a user's live server from the
vanilla Git tree.

Relevant integration points inspected:

| Purpose | Existing source |
| --- | --- |
| Panel provider registration | `config/app.php`, `bootstrap/app.php` |
| Admin authentication and routes | `app/Providers/RouteServiceProvider.php`, `app/Http/Middleware/AdminAuthenticate.php` |
| Sessions and CSRF | `app/Http/Kernel.php` |
| Admin navigation | active `resources/views/layouts/admin.blade.php` |
| Arix editor navigation | active `resources/scripts/routers/AdminRouter.tsx` |
| Arix server/account frontend routes | active `resources/scripts/routers/routes.ts` |

Use manifests and installed source fingerprints for compatibility. Do not rely
solely on the Panel's displayed version; the repository's configuration can
report `canary`. Its current manifests require PHP 8.2-compatible dependencies
and Node >=22; the older `BUILDING.md` tool versions are not authoritative.

## 2. Deliverables and folder layout

Distribution layout:

```text
addon-manager/
  install.php                    # Standalone initial installer
  bootstrap.php                  # Manager namespace/provider bootstrap
  bin/manager.php                # Doctor, recovery, and maintenance commands
  src/                           # PHP services, controllers, worker, registries
  routes/admin.php
  resources/views/
  public/build/                  # Prebuilt, versioned manager UI assets
  schemas/addon.schema.json
  adapters/                      # Tested bootstrap/navigation/source adapters
  migrations/                    # Manager-owned registry tables
  sdk/                           # Addon scaffold and export/validation tools
  README.md
```

Private state defaults to `storage/app/addon-manager/` and contains
frozen packages, baseline code, staging builds, backups, journals, and recovery
metadata. Its public assets have a separate controlled deployment destination.
State must never be placed in `storage/app/public/` or another served directory.

Keep the manager outside `addons/`. Arix's `php artisan addons install`
enumerates every subdirectory there as a potential version payload. Panel also
has an executable `addons/*/hooks/<event>` lifecycle mechanism. Neither is the
new manager's registry. Existing game-server plugin tables are also separate.

The initial command is:

```sh
php addon-manager/install.php --panel-root=/var/www/pterodactyl
```

The release ZIP contains only this folder. Download and extract a reviewed
release through SSH as an alternative to copying it; no production Git checkout
is required. Use a fresh distribution and follow the
[upgrade guide](../../addon-manager/docs/UPGRADING.md) before replacing an older
manager. Active legacy registration or state is refused; automatic migration
is outside version 2.0.0.

The installer must be repeatable. It checks PHP/extensions, panel bootability,
database connectivity, writable destinations, disk space, queue/worker setup,
and source adapter matches before changing anything. It backs up its small
bootstrap/navigation changes, registers the manager, creates its tables, and
performs readiness checks. Repeat installation must not duplicate menu entries,
providers, or migrations. Missing service-control permission needs a precise
setup instruction, not unrestricted sudo access from the web application.

## 3. Admin experience

Expose an **Addon Manager** navigation entry and `/admin/addon-manager` page.
Use the existing admin session, root-admin check, two-factor requirement, and
CSRF protection for the page and every management endpoint. The manager must
not depend on Arix's obfuscated controllers or alter Arix license enforcement.

For the first release, use the existing Blade admin layout and prebuilt manager
JavaScript/CSS. This avoids rebuilding the Panel frontend merely to install the
manager. A direct manager URL remains available if an external theme update
removes the navigation patch. Arix editor navigation can be a tested additional
integration rather than a requirement for the core manager to function.

Show every managed addon with ID, name, installed version, enabled status,
compatibility, dependency/dependent information, and the last operation result.
Actions: **Install**, **Update**, **Enable/Disable**, **Delete**, and operation
details. Install opens a URL prompt. Compatible packages proceed through
download, verification, staging, and installation with visible progress.
Blocked packages show a concrete reason, including affected addons and paths.

Disable/delete of a dependency must identify all affected dependents. Block the
action or offer an explicit combined action; do not silently disable unrelated
addons. Delete preserves addon data. A data-purge operation is outside the v1
runtime contract.

Long operations run in a dedicated management worker, not an HTTP request or
the regular game-server task queue. Return an operation ID immediately; poll
authenticated progress endpoints. Retain useful diagnostics across refreshes.
During maintenance or process restart, the UI may temporarily lose contact;
reconnect to the same persisted operation rather than submitting it again.

Separate implementation services: package URL resolver and downloader, archive
validator, manifest validator, dependency planner, baseline/package store, patch
composer, actual-change verifier, extension registry, migration executor,
operation coordinator, deployment activator, and standalone recovery runner.
Controllers expose these through authenticated actions and progress queries;
they do not perform installation work directly.

## 4. Supported links and addon exports

First release supports public GitHub release ZIP assets and tagged/commit-pinned
repository package URLs. A GitHub folder/tree URL can be resolved to a specific
commit, downloaded as a repository archive, and reduced to the designated addon
directory. GitHub does not provide a standard ZIP export of one folder.

The preferred developer workflow is a dedicated release ZIP generated from an
addon folder. Supply an SDK scaffold, manifest validator, and export tool, plus
a GitHub Actions example that builds assets and publishes that ZIP. A package
must be self-contained; its manifest points to its own relative payload files.

Resolve a URL once, record the immutable commit/tag identity when available,
archive digest, source, and package version, and retain the exact package bytes.
Never fetch a moving branch again when reconstructing an installed version.
Updating is an explicit operation. A checksum identifies received bytes; it is
not proof of author trust. Private GitHub authentication and additional download
hosts are later features, with credentials stored securely rather than in URLs.

## 5. Manifest contract and installation ledger

The developer manifest is a strict contract, not executable installer logic.
Version the JSON schema, reject unknown operation types, and validate these
fields before applying code:

| Field group | Required information |
| --- | --- |
| Identity | Stable addon ID, version, display name, manifest format |
| Compatibility | Manager, Panel and PHP ranges; optional Arix and Addon Pack ranges |
| Relationships | Dependencies with version ranges; explicit incompatibilities |
| Files | Payload paths, exact destinations, ownership, checksums |
| Patches | Target owner/version, file, unique source fragment/context, expected fragment checksum, replacement/patch, expected result |
| Registrations | Routes, pages, menus, events, jobs, schedules and assets |
| Build | Supported build mode, inputs, generated-output locations |
| Database | Supported schema operations, migration IDs/checksums, data policy |

Illustrative manifest fragment using the implemented patch contract:

```json
{
  "id": "example.dashboard-extension",
  "version": "1.0.0",
  "manifestVersion": 1,
  "dependencies": [{ "id": "example.dashboard", "version": "^1.2" }],
  "patches": [{
    "id": "extend-dashboard-summary",
    "target": "app/Addons/ExampleDashboard/SummaryService.php",
    "owner": "addon:example.dashboard",
    "find": "patches/find.txt",
    "replace": "patches/replace.txt",
    "beforeSha256": "<SHA-256 of exact find.txt bytes>",
    "afterSha256": "<SHA-256 of exact replace.txt bytes>"
  }]
}
```

Depending on another addon does not permit unrestricted overwriting. A dependent
that patches its dependency must name exactly which file/fragment it changes
and the version/source it expects. Reject missing or ambiguous matches and
fuzzy patch application. Line numbers alone are insufficient. Nonoverlapping
changes in the same file may coexist; independent replacement of the same
fragment is incompatible unless there is a verified, declared composition.

Build a dependency graph, reject cycles, and apply packages in deterministic
dependency order. Recheck every enabled dependent when its dependency updates.
Do not auto-install an unspecified dependency from an inferred repository.

The installer records facts in its own ledger, without modifying developer
manifests. Record package digest, baseline ID, dependency order, original owner,
parent patch operation, touched paths, actual pre/post file and fragment hashes,
patch bytes, generated files, migration history, and validation results. Keep
protected original blobs/checkpoints for auditing and recovery.

Manager registry tables: `addon_manager_addons`, `addon_manager_addon_versions`,
`addon_manager_addon_operations`, `addon_manager_addon_dependencies`,
`addon_manager_addon_file_changes`, and `addon_manager_addon_migrations`. Maintain a durable
filesystem recovery record as well, so database or Laravel boot failure does
not prevent recovering an interrupted deployment.

## 6. Reconstruction and lifecycle operations

Capture the installed baseline after the manager bootstrap succeeds and before
the first managed addon. Include existing working Panel/Arix/custom code and
assets; exclude `.env`, credentials, runtime storage, logs, uploads, sessions,
and manager state. Existing manually installed addons are initially part of the
baseline. They do not automatically acquire independent disable/delete support;
adopting them requires a separate verified conversion.

Every lifecycle action produces a desired enabled-addon set. Compare live
managed files against the last active inventory first. Unexpected manual edits
or external Panel/theme updates block reconstruction instead of being erased.
Baseline replacement requires an explicit maintenance/rebase workflow, addon
revalidation, and retention of the previous recovery state.

Operation pipeline:

1. Acquire one deployment lock and create a durable transaction journal.
2. Resolve/freeze a new package when required; validate archive and manifest.
3. Resolve compatibility, dependencies, ownership and affected dependents.
4. Reconstruct code from the baseline plus the desired enabled packages.
5. Apply only declared operations and compare actual changes with declarations.
6. Check PHP syntax, assets, registrations, integration behavior and build output.
7. Prepare touched-file backups and supported database steps.
8. Enter maintenance, quiesce affected workers/scheduled dispatch, and activate.
9. Refresh required caches, restart workers, and run readiness checks.
10. Commit registry state and leave maintenance only after success.

Staging must not execute addon code with production credentials. Integration
validation uses synthetic configuration and disposable test state. Syntax and
manifest checks alone cannot establish functional compatibility.
Code-executing builds and tests require the supported rootless Docker runner
with enforced filesystem, network, and resource controls.
It must have no live-code write access, production secret access, production
database access, or privileged host socket mounts. Merely clearing environment
variables while running as the Panel's OS user is insufficient. The initial
doctor checks this capability; if unavailable, execution-dependent installation
modes remain blocked until a supported runner is configured. Declare this
prerequisite in release documentation rather than silently weakening validation.

| Action | Desired result |
| --- | --- |
| Install | Add the resolved version and enable it after successful validation |
| Update | Replace that version, revalidate its dependents, retain old package |
| Disable | Rebuild without it; retain its package and data |
| Enable | Revalidate and reconstruct with its retained package |
| Delete | Remove it from the enabled set, then remove stored package once recovery references permit |

Removing a dependent restores its dependency through reconstruction, preserving
valid changes from remaining addons. Do not restore a whole old dependency file
over other addons' changes. Removing a dependency requires resolving all reverse
dependents first.

Disable unregisters menus, routes, listeners and schedules. Queued addon jobs
carry addon/version identity and check activation before execution. Already
running work must be drained or stopped safely; disabling does not undo actions
already performed. SDK job wrappers should remain manager-owned so stale jobs
can be skipped even when the addon package is no longer deployed.

## 7. Activation, rollback, and database boundaries

V1 preserves the existing panel directory and web-server configuration. Prepare
code separately, back up every changed live file, and activate through
same-filesystem temporary files and per-file rename while the panel is in
maintenance and relevant workers are stopped. This is not atomic across all
files. A transaction journal and recovery procedure are therefore mandatory.

Journal intended/applied/verified steps and make retries idempotent. A standalone
`bin/manager.php recover` command must work without booting modified Laravel.
It restores a consistent checkpoint or completes a verified operation. Protect
the manager's bootstrap/recovery files from addon patches. Do not reopen the
panel if recovery or compatibility is uncertain. Test process termination at
every activation boundary.

An optional later release-directory/symlink deployment can shorten activation,
but should not require changing the user's nginx layout for the first release.
Coordinate PHP OPcache and long-lived processes; a cache-clear command alone
does not guarantee all workers have stopped running old code.

Database changes have a different recovery contract. MySQL DDL may commit
implicitly. V1 allows manager-executed declarative, additive, backward-compatible
schema operations on addon-owned, namespaced tables. No arbitrary SQL, PHP
migration hooks, destructive transformations, or external install actions in the
initial manifest format. More advanced data migrations require a separately
designed trusted migration feature.

Track migration checksums and never run a global `migrate:rollback` to remove
one addon. Disable/delete preserves schema and data by default. Require a usable
backup/recovery strategy before production schema changes. Old code can only be
restored if it remains compatible with the resulting schema; otherwise retain
maintenance and report explicit recovery steps. Do not claim filesystem rollback
reverses data changes or remote actions.

## 8. Extension surface and frontend modes

V1 supports registered admin pages, menus and API routes, events, jobs,
schedules, and controlled source patches. Client pages, server tabs, dashboard
widgets and an embedded React bridge remain future design work. Any future
client/server extension must use the Panel's existing authorization model.

Standalone pages ship prebuilt assets and can avoid rebuilding the host panel.
Components embedded in native React pages need a versioned bridge contract for
authentication, API access, styling, navigation, and shared dependencies. Design
and test that bridge rather than assuming an arbitrary bundle can join React.

Addons that patch native frontend source require the matched host toolchain and
a production build in staging. Declare generated outputs, record them in the
ledger, and validate asset manifests. A separately compiled bundle cannot by
itself replace a component already compiled into Panel assets. No ad hoc
`yarn add`, Composer mutation, or arbitrary lifecycle commands during v1 installs.
New host dependencies need an explicitly supported compatibility/build profile.
Hash-named shared Panel bundles are outputs of the composed installation, not
files owned solely by the most recently installed addon. The manager's build
profile restricts their output directories and records the concrete generated
asset list; removal rebuilds that shared bundle from the remaining addons.

Keep Arix's obfuscated admin controllers and licensing unchanged. V1 supports
patches to readable Panel/Arix/Addon Pack code through tested exact matches;
patching obfuscated internals is outside the first supported compatibility scope.
The manager cannot guarantee arbitrary addon combinations or future theme
versions will work. Its job is to reject incompatible combinations safely.

## 9. Security and operational design

- Restrict URL resolution initially to supported HTTPS GitHub hosts and vetted
  redirects. Validate destination addresses at connection time, including each
  redirect; deny internal, loopback, link-local and metadata endpoints. Retain
  TLS verification, limit download size/time/redirects, and redact URL credentials.
- Extract only into new private staging paths. Reject traversal/absolute paths,
  backslash/drive ambiguities, symlinks, hardlinks, normalized duplicates,
  case collisions, excessive entry counts, expansion size and compression ratio.
- Enforce canonical path containment for every destination. Protect `.env`,
  manager/recovery machinery, credentials, runtime user data and dependency
  directories. Do not permit uploaded PHP under public web paths.
- The manager executes declared operations itself. Reject arbitrary install,
  uninstall or shell scripts. Run builds/validation with bounded resources and
  enforced filesystem/network isolation, without production secrets. Custom addon PHP at runtime is still trusted code
  with application privileges; manifest compliance does not make it a sandbox.
- Use an authenticated, authorized, CSRF-protected admin API with rate limits,
  operation IDs, audit trails and one global lifecycle lock. Separate a narrow
  write-capable management worker from web request handling where host support
  allows it; never expose a generic shell endpoint or run the web app as root.
- Tune dedicated worker timeout, retry interval, locking and retry behavior for
  lengthy builds. Prevent duplicate activation and starvation of existing panel
  jobs. Retain bounded checkpoints and refuse installation when disk is insufficient.
- Avoid scanning/patching/building on normal requests. Use a cached enabled
  registry and lazy-load frontend assets. Source-patching changes may need a build
  and a brief maintenance window; ordinary hooks should be cheaper to toggle.

## 10. Milestones and completion gates

| Milestone | Work | Gate before moving on |
| --- | --- | --- |
| 1. Contract and fixtures | JSON schema, graph/ownership rules, SDK scaffold/exporter, test packages | Validator rejects malformed packages; exported folder resolves to one valid package |
| 2. Drop-in bootstrap | Standalone installer, live doctor, compatibility adapters, provider/routes/nav, recovery CLI | Install twice on fresh and Arix-configured fixtures without duplicates; admin-only manager works without a Panel rebuild |
| 3. URL installs and UI | GitHub resolver, private package store, operation registry, dedicated worker, list/progress/details | Admin pastes a release URL and installs a simple functional addon without FTP |
| 4. Patches and dependency lifecycle | Frozen baseline, staged rebuild, actual-change ledger, dependency patches, enable/disable/update/delete | Dependency restoration and conflicts work; undeclared changes leave live code untouched |
| 5. Activation and extensions | Journal/lock, crash recovery, safe schema steps, frontend bridge/build profiles, job shutdown | End-to-end lifecycle passes on the supported Panel/Arix/Pack combination, including injected failures |
| 6. Release | Manager-only ZIP, checksums, bootstrap/service instructions, developer guides and example addon release | Install manager on a fresh server fixture, install/update/remove addons solely through admin URLs, recover after an interrupted activation |

The implementation covers the v1 contract across milestones 1-6. Embedded
frontend bridges and additional service/source adapters remain future work;
the verification record documents limits. Private sources,
arbitrary migration hooks, obfuscated-code patching, multi-server coordinated
deployments, and arbitrary dependency installers are explicitly outside v1.

## 11. Required acceptance scenarios

- Non-admin access denied; unauthenticated/CSRF-invalid install actions denied.
- Valid public GitHub ZIP and designated-folder link install the expected addon.
- Malformed archives, unsafe paths, internal URLs and oversized downloads reject.
- All installed package files match declared checksums and destinations; undeclared
  modifications quarantine that package version and leave the live panel unchanged.
- Independent edits in one file coexist; independent overlapping replacements reject.
- B patches dependency A; removing B restores A while retaining independent C changes.
- Disabling/deleting A identifies B and all transitive dependents; dependency cycles reject.
- Updating A invalidates B's source precondition and leaves the active installation intact.
- Failed PHP validation, frontend build, or health check never reports a successful install.
- Manual live edits or external theme updates stop reconstruction without erasing them.
- Repeated bootstrap and repeated operation delivery do not duplicate changes or migrations.
- Concurrent operations serialize; interrupted activation recovers through the standalone CLI.
- Addon-owned database data survives disable/delete; unsupported destructive migrations reject.
- Disabled routes return the intended unavailable response; menus/listeners/schedules disappear;
  stale queued jobs do not execute disabled addon logic.
- Normal admin login, client login, server console and existing Arix/Pack features still work
  after each install/update/disable/delete sequence on the supported integration fixture.

Use focused unit tests for schema/patch/graph/archive logic, integration tests for
authorization and registries, browser tests for admin flows, and full installation
fixtures for builds/recovery. Pin fixtures to known sources and test the upgraded
production version before declaring it supported. No readiness claim rests on a
zero-test run or file placement alone.

## 12. Release documentation and operating contract

Ship an administrator guide for initial installation, management worker setup,
GitHub URLs, backups, drift/rebase handling and recovery; a developer guide for
manifests, patches, dependency modifications, frontend modes, export workflows
and migration restrictions; and at least three sample packages exercising basic
extension, dependency patching, and deliberately incompatible modification.

An administrator should be able to install the manager once, paste addon links,
see the exact installed versions, and manage their lifecycle without FTP. The
manager must explain when a build, maintenance window, dependency action, or
manual recovery is required. It must not present trusted executable addons as
safe merely because their manifest was followed.
