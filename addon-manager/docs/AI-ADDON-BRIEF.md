# Copy-and-paste addon development brief

Copy the block below into a repository-enabled coding chat. Replace the feature,
addon ID, version and actual target details. Ask it to implement the feature and
produce the ZIP, not only describe a plan. The [authoring guide](ADDON-AUTHORING.md)
explains the workflow and the [developer reference](DEVELOPER.md) covers details.

```text
Build the following addon for the existing neutral Addon Manager:

FEATURE: <describe the desired behavior>
ADDON ID: <stable lowercase ID, for example mycompany.status>
ADDON VERSION: 1.0.0
AUDIENCE: <root admins, customers, or both>
TARGET PANEL/PHP/ARIX/PACK: <actual versions and source variants; say unknown where unknown>
DEVELOPMENT REPOSITORY: <owner/repository>
PUBLIC RELEASE REPOSITORY: <owner/repository, or report if none is available>

Manager contract repository:
https://github.com/KonnectHosting/Konnect-Hosting-Panel-Custom-Addons

Baseline contract: manager 2.0.1, manifestVersion 1, source commit
5a899b28aa80b08f3ab8a5cbae3e5315cc5c2563.
Read the SDK matching my installed manager before writing a manifest. Obtain
repository access if necessary; do not invent a replacement plugin format.
The new authoring guide and this brief are on main and were added after that
SDK source pin. Read them as documentation; validate against the matching SDK.
If my manager version differs, inspect that version's contract and report any
changes to the assumptions in this brief.

Read these files first:
- addon-manager/docs/ADDON-AUTHORING.md
- addon-manager/docs/DEVELOPER.md
- addon-manager/schemas/addon.schema.json
- addon-manager/src/Core/ManifestValidator.php
- addon-manager/src/Core/PackageValidator.php
- addon-manager/src/Core/Paths.php
- addon-manager/sdk/README.md
- addon-manager/sdk/examples/basic-admin-page/manifest.json and payload
- addon-manager/sdk/examples/dependency-banner/manifest.json and fragments
- addon-manager/sdk/ci/export-addon.yml

Deliver a clean self-contained addon/ deployment folder with manifest.json.
Keep tests, development tools, dependencies, CI files, manager checkout and
exported ZIPs outside addon/. Every payload/fragment/migration file must be
declared. Only the supported root README/LICENSE files may be extra metadata.

Use the actual schema keys: manifestVersion, id, name, version, compatibility,
dependencies, incompatible, files, patches, extensions, database, build.
Do not invent install/uninstall scripts, arbitrary shell hooks, service-provider
registration, client pages or a dynamic React bridge.

Report integration gaps early. Built-in pages/routes are root-admin extensions
under /admin/addon-manager/extensions/<addonId>/, with permission admin. They do
not become customer pages by changing a permission string. Customer/server tabs
need additional supported integration work, exact patches/builds or a manager
extension. Explain and test the chosen approach before claiming it works.

Put new classes under app/Addons/<UniqueNamespace>/ with matching
Pterodactyl\Addons\... namespaces and declared file targets. Declare Blade views
under resources/views/addons/<unique_slug>/. Keep extension IDs unique across
all categories; use lowercase literal endpoint paths.

Use files entries only for new destinations. Existing files need exact patches
with correct owners and hashes of the exact UTF-8 find/replace fragment bytes.
Patching another addon requires a declared dependency and addon:<id> ownership.
Preserve independent addons' changes. Do not weaken path, conflict, drift or
ownership checks, or patch protected manager/auth/bootstrap/licensing code.

Keep Arix optional unless the feature requires it. Declare only tested version
ranges. Manager 2.0.1 has measured 1.15.1 profiles; a manifest saying 1.15.2 or
an overwritten version label does not establish 1.15.2 host support.

Use only additive JSON migrations on addon-owned namespaced tables. Preserve
data on disable/delete. No arbitrary PHP/SQL, destructive migrations or
unique:true indexes pass the 2.0.1 package validator. Never edit an applied
migration; add a new immutable migration ID/source. Test old-code compatibility.

Use build.mode none for standalone declared static assets/Blade. Native Panel
frontend edits can declare new source files and exact patches to existing files;
they require the panel-v1 build profile with outputs under
public/assets, the supported host toolchain and frozen dependencies. Do not
modify dependency manifests/lockfiles or assume package-manager hooks can run.
Use manager-guarded events/schedules/jobs where applicable.

Preserve authentication, authorization, CSRF and per-server permissions.
Validate input and escape output. Do not include credentials, live data,
licensing bypasses, vendor/node_modules, .env or PHP under public paths.
Executable addon code has application privileges after activation.

After reviewing final source/build bytes, calculate real SHA-256 values for
all declared files, fragments and migrations. Do not leave placeholder hashes
or change the installed manager ledger to make validation pass.

Using the matching manager SDK checkout at _manager/:
  php _manager/addon-manager/sdk/bin/addon.php validate addon
  mkdir -p dist
  php _manager/addon-manager/sdk/bin/addon.php export addon --output=dist/<slug>-1.0.0.zip
  (cd dist && sha256sum -c <slug>-1.0.0.zip.sha256)

Use an unused output filename; export never overwrites the ZIP or sidecar.
Test behavior, denied permissions, update, disable, re-enable, delete, data
retention, relevant dependency conflicts and recovery on a disposable copy of
the intended installation. Separate tests run/passed from checks not run.
SDK validation/export alone is not evidence of production compatibility.

If GitHub publishing access is available, publish the SDK ZIP and checksum as
public GitHub release assets. Otherwise leave the artifacts ready and report
the exact publishing step that remains. Supply the release ZIP install URL:
  https://github.com/<owner>/<repo>/releases/download/v1.0.0/<slug>-1.0.0.zip
or the self-contained folder URL:
  https://github.com/<owner>/<repo>/tree/<full-40-character-commit>/addon

Private development repository access through your GitHub tools does not make
private sources installable by this manager. Do not change repository visibility
or publish unrelated licensed/source material to work around that limitation.
Report the limitation if the addon itself must remain private.

Return the source/package path, manifest, ZIP, SHA-256 sidecar, install URL when
published, supported host versions, feature usage/update instructions, validation
results and known limitations. Do not deploy to my live Panel automatically.
```

The manager worker/runner/service-control prerequisites are a separate host task.
An addon chat must not claim an installation is operational merely because its
ZIP validates or the manager's admin page loads.
