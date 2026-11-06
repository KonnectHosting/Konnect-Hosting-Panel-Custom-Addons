# GMod Toolkit 1.2.0 verification

Contract: Addon Manager 2.0.1 source 5a899b28aa80b08f3ab8a5cbae3e5315cc5c2563;
repository baseline 43927ae7c65e4e8578f9cfd63ffb4d62e60f1ad5. Runtime tests
use PHP 8.3.36, real locked Laravel dependencies, Debian 12/Python 3.11, Node 22
and synthetic hosting data. No production Panel, node, container or Proxmox
configuration was modified.

## Executed checks

- Dedicated upload-root regression: existing Wings API calls read only `/fastdl`
  (plus parent metadata), and never read `garrysmod/` assets. Ordinary-directory,
  symlink, traversal and transfer checks cover the root and its ancestors. Folder
  preparation uses existing file API calls, requires write permissions, preserves
  uploads and game files, and is idempotent. A 2,500-file upload set is enumerated;
  this checks scanning, not live large-file throughput.
- Source-location upgrade: old unfinished previews cannot be published or resumed
  from the former root; current published objects and URLs remain readable.
- Independent Workshop status returns backups without invoking FastDL. Neither
  the customer pages, generated Lua nor status output contains mounting guidance.
  FastDL and Workshop are distinct named routes; the former umbrella is an
  unnamed bookmark redirect, which Arix excludes from Missing Links.

- Reproduced the reported missing settings/app:telemetry:uuid failure with 1.1.0
  and the original 2.0.1 probe in a networkless, read-only container with an empty
  temporary SQLite database. Version 1.2.0 passes that unchanged probe: 2 handler
  classes, 2 extension routes, 1 page, 0 schedules; Laravel boot and PHP lint pass.
  tests/isolated-probe.py makes this regression repeatable.
- The repository's generic probe now disables host telemetry only inside its
  synthetic process so legitimate scheduled addons can be inspected without
  production settings. The previous scheduled 1.1.0 candidate passes the fixed
  probe (1 schedule). The delivered 1.2.0 addon does not require this manager patch.

- SDK validation, PHP syntax, source/fragment hashes and SDK export round trip.
- 34 Panel/Workshop/FastDL tests: nested/cyclic Workshop collections, safe Lua,
  hostile IDs/links, wrong-game/private items, real Panel owner/subuser policy,
  CSRF, two-factor, server membership/suspension, Lua updates via the actual
  Wings write contract, backup/restore, stale previews and enabled-version guards.
- Panel FastDL tests: automatic egg recognition; asset allowlist; asynchronous
  snapshot preparation; existing Wings API response/transfer size limits and link
  flags; exact previews; real standard-library bzip2 round trip; canonical Panel-hostname
  URLs; independent server tokens; forbidden public paths; rotate/revoke; actor
  binding/expiry; replayed queue steps; snapshot tampering; failed rebuilds
  preserving old publications; in-flight revocation; execution-time permission
  checks; interrupted-step recovery; actual manager guarded-job dispatch; public
  denial on suspension/deletion/disabled eggs; and real anonymous HTTP downloads
  restricted to approved assets while enabled.
- Steam-shaped collection fixtures omit `file_type` from published-file metadata
  and use collection children's `filetype`. Both ID and link forms resolve,
  nested collections are excluded from generated download calls, and unsupported
  child types fail. The screenshot's collection ID is used with synthetic
  children; no claim is made to have queried its live contents.
- Reproduced the installed manager's missing `bus` binding through real queue
  dispatch. The addon now resolves the Laravel dispatcher contract and retains
  the manager's exact-version/registration guards and native AddonJob wrapper.
  Actual bus serialization and the database-backed `standard` queue complete
  scan, preview, compression and publication with the unmodified 2.0.1 manager
  dispatch implementation still installed. Stalled/expired jobs and rejected enqueueing are
  covered. No manager update is required for this addon.
- The repository's generic dispatch method also uses the supported contract.
  `addon-manager/tests/JobDispatchIntegration.php` boots real Laravel without the
  legacy alias, records the native guarded job, and rejects disabled addons,
  wrong versions, unknown jobs and non-JSON payloads without executing handlers.
- Manager lifecycle fixtures for stock Panel, Arix 2.1.3 and Arix+Pack 2.0.2:
  install, same-ID update, disable, re-enable, delete, retained private data and
  source drift failure. Fixture build/verifier callbacks are test doubles, not
  production isolation attestations.
  The actual published 1.1.2 archive was also installed and upgraded to 1.2.0
  in all three variants, checking reconstruction of the changed route patches
  and the additional independent page files.
- Stock native frontend: full TypeScript, targeted ESLint and production webpack
  build were rerun for 1.2.0. Arix before/after type comparisons introduced zero errors; full Arix
  compilation is not claimed because the root dependency set omits theme
  dependencies (92/100 existing baseline errors). The live host must retain its
  existing matched frozen theme dependencies.
- Full repository archive extraction and package-folder selection through the
  matching SDK, including the standalone publication root. Public GitHub commit
  identity and live archive availability are checked before delivery.
  Publication: 164aadb9d6235566dc7de1b34e96788ed901f49a.

## Live checks still outside this environment

Test the generated Lua and FastDL downloads in a real GMod client, and exercise
actual Wings responses and the installed theme's frozen build on a disposable
copy of the intended hosting installation. Tests here use fake Wings/Steam
responses and synthetic DB records; they do not establish live Steam or game
behavior. The package uses the Panel's existing queue and Python 3;
there is no separate node service or container-side installation to validate.
