# Moving to Addon Manager 2.x

Addon Manager 2.0.0 uses `addon-manager/`, the PHP namespace `AddonManager`,
`storage/app/addon-manager/`, `addon_manager_*` SQL tables, and
`/admin/addon-manager`. The earlier branded distribution used
`konnect-addon-manager/` and separate registration, state, and SQL names.
An in-place conversion of that distribution is not supported.

Version 2.0.0 is a breaking release because the PHP namespace, URLs, private
state and audit table names changed. Packages declaring compatibility only with
manager 1.x are refused. Review the package's API references and update its
manager compatibility constraint before exporting it with the neutral SDK;
changing that constraint alone does not establish code compatibility.

The installer refuses explicit legacy code, private state, public assets,
configuration, or registration before booting Panel or capturing a baseline.
This also applies to a dry run. It preserves the legacy installation and reports
the detected path. A renamed registry that still refers to a legacy baseline is
also refused. The neutral bootstrap recovery command reads only neutral backup
records; it does not remove an earlier manager's registration.

## Fresh installations

If the branded manager has never been installed, deploy the complete neutral
folder directly inside an existing, working Panel root and follow the
[administrator guide](ADMINISTRATOR.md). Start with:

```sh
php addon-manager/install.php --panel-root=/var/www/pterodactyl --dry-run
```

Supported source adapters currently identify Panel 1.15.1, Arix 2.1.3, and Addon
Pack 2.0.2 from exact deployed fingerprints. A matching version label alone does
not establish compatibility. Keep Arix's licensed and obfuscated files unchanged.

## Existing branded installations

Perform the transition first on a private staging copy with a disposable copy of
the database. Keep the original installation operational until the replacement
has passed its checks. Neither copying live modified source into a fresh Panel
nor deleting the old registry establishes a clean baseline.

1. Retain a recoverable backup of the complete Panel, database, original branded
   manager folder, and `storage/app/konnect-addon-manager/`. Preserve its frozen
   packages, baselines, installer backups, journals, database snapshots, and
   worker configuration. Store backups outside the Panel tree and public storage.

2. Use the original manager and its original worker to resolve interrupted or
   queued operations. Run its diagnostics and require the retained-baseline,
   source-drift, and recovery checks to pass. Do not attempt a neutral install
   while legacy work remains pending.

   ```sh
   php konnect-addon-manager/bin/manager.php --panel-root=/var/www/pterodactyl doctor
   ```

3. Remove every addon managed by the branded manager using that manager's
   supported delete operations. Process dependencies explicitly, or review the
   affected dependency set before using `--cascade`. Wait for each queued
   operation to finish through the original worker and inspect its durable result.
   Disable and delete preserve addon-owned database data.

   ```sh
   php konnect-addon-manager/bin/manager.php delete --addon-id=example-addon --panel-root=/var/www/pterodactyl
   php konnect-addon-manager/bin/manager.php operation --operation=RETURNED_OPERATION_ID --panel-root=/var/www/pterodactyl
   ```

4. Verify that the legacy registry has no retained addons, no enabled order,
   and identical `activeInventory` and `baselineInventory`. Its doctor must also
   confirm that the live source matches that inventory and the retained baseline
   is intact. These are prerequisites to removing the integration. If they do
   not hold, continue recovery through the original manager; stop the transition.

   Before removing the original loader, also resolve its addon job messages in
   the ordinary Panel queues, including delayed, reserved and retryable messages.
   Keep the old loader available while its wrappers safely skip deleted addons.
   Use reviewed queue tooling for any messages that need explicit removal; do
   not purge unrelated Panel jobs. Serialized wrappers retain their original PHP
   namespace and cannot be handled by the new loader after the old code is archived.

5. Stop and disable the old manager's supervised worker and enter a planned Panel
   maintenance window. Recover the original bootstrap and navigation with the
   original distribution's installer:

   ```sh
   php konnect-addon-manager/install.php --panel-root=/var/www/pterodactyl --recover-bootstrap
   ```

   This command requires the original verified registration backups and refuses
   unexpected live edits. Inspect both integration files afterwards and confirm
   that no legacy provider or navigation registration remains. A missing backup
   record can return no restored files; that result does not prove the
   registration was removed. If recovery refuses or records are missing, keep
   the original installation and investigate its backups rather than editing
   marker text to bypass the guard.

6. After verifying recovery, archive `konnect-addon-manager/`,
   `storage/app/konnect-addon-manager/`, `public/konnect-addon-manager/`, and any
   `config/konnect-addon-manager.php` or `config/konnect-addons.php` outside the
   Panel tree. Preserve permissions and retain the original backup paths in the
   archived records. Do not rename them into their neutral equivalents. Remove
   references to the old worker from service configuration, clear Panel config,
   route and view caches, and restart services using the deployment's supported
   process. Confirm normal Panel behavior on the restored source.

7. Deploy the complete neutral release and run its dry run. Continue only when
   the source profile and host prerequisites pass. Install, configure the neutral
   worker and isolated runner, and verify the new admin page and diagnostics as
   described in the [administrator guide](ADMINISTRATOR.md).

   ```sh
   php addon-manager/install.php --panel-root=/var/www/pterodactyl --dry-run
   php addon-manager/install.php --panel-root=/var/www/pterodactyl
   php addon-manager/bin/manager.php --panel-root=/var/www/pterodactyl doctor
   ```

The installer leaves inactive `konnect_addons` and `konnect_addon_*` database
tables untouched. Their history is not imported into `addon_manager_*` tables.
Keep those records and addon-owned data for recovery. An addon with existing
database data needs an explicit compatibility and migration-history review before
installation through the neutral manager; the fresh registry does not establish
that previously applied migrations are safe to execute again.

## Retained neutral state

### Updating 2.0.0 to 2.0.1

Test the update on a private staging copy first. Back up Panel code, database,
and the complete private manager state outside the Panel tree. Finish queued
operations and resolve interrupted deployments with the original release before
replacing the loader. Stop the management worker and use the deployment's
maintenance and service-drain procedure while replacing the complete
`addon-manager/` folder. Keep private state and SQL history in their existing
locations; do not overlay stale loader files or copy them into the retained
Panel baseline.

Run the new installer's dry run, repeat installation, and both host and manager
diagnostics before resuming the worker and normal services. Clean retained
2.0.0 state is supported. Version 2.0.1 checks the actual runtime against addon
compatibility ranges, so a package pinned only to manager `=2.0.0` needs a
reviewed compatibility update. The manifest format and `^2.0` SDK example
constraints are unchanged.

The stricter checks preserve and reject unexpected baseline bytes or credential
stores retained by 2.0.0, including authentication-bearing npm/yarn configuration.
They do not silently recapture a baseline or change its ledger. An interrupted
2.0.0 journal with an existing temporary file but no inode ownership receipt
also requires operator review; 2.0.1 preserves that file rather than deleting it.
If these checks fail, keep backups and complete an explicit staging recovery or
baseline review. Do not delete the registry, migration history, temporary file,
or snapshot merely to make a check pass.

Reload the admin page after updating. Asset URLs include the manager version so
the browser fetches the new client. Mutation requests now require
`X-Addon-Manager-Actor` to match the authenticated administrator ID. An old tab
or a changed session is refused before enqueue; preserved pending request IDs
must be retried through the matching account after refresh.

For repeat installation of the neutral distribution, keep its existing private
state, retained baseline, and SQL tables in their original locations. The
installer recognizes its exact registration and verifies retained source through
the active ledger. Do not delete the neutral registry to make source drift pass
or turn modified addon source into a new baseline. Read the release's documented
compatibility requirements before changing manager versions.
