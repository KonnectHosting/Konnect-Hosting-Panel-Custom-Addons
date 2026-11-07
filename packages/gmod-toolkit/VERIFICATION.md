# GMod Toolkit 1.5.0 verification

Contract: Addon Manager 2.0.1 source 5a899b28aa80b08f3ab8a5cbae3e5315cc5c2563;
repository baseline 43927ae7c65e4e8578f9cfd63ffb4d62e60f1ad5. Runtime tests
use PHP 8.3.36, real locked Laravel dependencies, Debian 12/Python 3.11, Node 22
and synthetic hosting data. No production Panel, node, container or Proxmox
configuration was modified.

## Executed checks

- Backdoor Scanner: 28 synthetic lexical/rule/archive regressions cover direct
  network execution, aliased/protected calls, simple variable flows, HTTP
  callbacks, fixed-identity privilege/allow decisions, rank-table writes,
  permission overrides, literal encoding/concatenation, persistence, sensitive
  commands, credential-transfer indicators, historical receiver names, benign
  comments/strings/globals, Unicode, native modules and bytecode. GMA v1/v2/v3,
  LZMA-alone, member paths/CRC/bounds, malformed archives and CLI non-execution
  are checked. Late critical evidence replaces weaker findings at limits.
- Scanner/start-guard Laravel tests cover targeted scope and a synthetic 120 GiB
  unrelated-asset metadata tree (not a real throughput test), retained findings
  before discovery/archive limits, incremental reuse, new/deleted/changed files,
  forced verification with preserved metadata, version-bound approval, current
  read/write/power permissions, legacy job retirement, cancellation/recovery,
  expiry, queue rejection and actual Wings GET contracts. The actual shared
  power repository holds starts until completion; approved forwarding bypasses
  only its own recursive hook, sends once, and stop cancels pending starts.
  Fresh GMod websocket permissions drop direct power rights without expanding
  subusers or adding admin rights. Non-GMod and disabled-addon cases retain
  native permissions. Native database queue/AddonJob serialization completes both
  the scanner chain and delayed power-check chain. Delayed availability is advanced
  only in the disposable test DB to avoid real sleeps. No real node is contacted.
- Browser checks exercise the actual shared Websocket class/PowerBridge with
  synthetic JWT/HTTP data: guarded start routes to the normal Panel endpoint,
  unmarked sockets retain their path, and queued power can be cancelled. Scanner
  UI checks cover default loose-code mode, explicit archive selection, reused
  result counters and exact-file approval, in addition to the existing gallery,
  FastDL, source escaping, filters, progress, report and mobile checks.

- Workshop artwork/metadata: trusted Steam CDN URL validation, HTTPS upgrades,
  bounded plain-text descriptions, size totals and missing-value handling.
  Collection input autosaves per customer/server without a Lua write, refreshes
  Steam data on each status load, and survives Lua apply/backup restoration.
  Changed metadata, invalid/empty drafts, actor/server separation, failed-refresh
  cache retention and selection changes during an in-flight request are covered.
- Workshop packaging: actual ZIP/GMA v3 bytes are read using native ZipArchive and
  an independent parser. Per-file CRCs, the GMA footer CRC, title, description,
  metadata, approved asset paths, normalized casing and 512 × 512 JPEG are checked.
  The native database-backed Panel queue also completes the export pipeline.
  Invalid covers, publisher-disallowed assets, empty files, case collisions,
  wrong actors/servers, permission changes, expiration and replaced previews are
  rejected. Replayed partial appends finish without duplicate bytes. Failed
  exports preserve HTTP publications, and public FastDL URLs cannot serve archives.
- Sixteen Chromium checks run the actual customer components/native Tailwind with
  synthetic transport/store/permission adapters: six gallery columns at 1600px,
  two at 390px, loaded thumbnails, escaped metadata, autosaved input, fresh page-open/manual refreshes without Lua
  application, applied gallery persistence,
  folder/preview flow, chosen name/description/image, PNG → 512px JPEG cover,
  authenticated package URL, mobile overflow, read-only controls and no server.cfg
  writes. Scanner checks add queued progress, severity/file/line context,
  escaped code, incomplete coverage, filters/low-priority indicators, report
  persistence/manual refresh, cancellation and mobile overflow. Screenshots and results are retained in the disposable browser output.
  This is not a test against a live Panel session or a Steam publishing account.

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
  temporary SQLite database. Version 1.5.0 passes that unchanged probe: 4 handler
  classes, 2 extension routes, 1 page, 0 schedules; Laravel boot and PHP lint pass.
  tests/isolated-probe.py makes this regression repeatable.
- The repository's generic probe now disables host telemetry only inside its
  synthetic process so legitimate scheduled addons can be inspected without
  production settings. The previous scheduled 1.1.0 candidate passes the fixed
  probe (1 schedule). The delivered 1.5.0 addon does not require this manager patch.

- SDK validation, PHP syntax, source/fragment hashes and SDK export round trip.
- 61 Panel/Workshop/FastDL/scanner/start-guard tests: nested/cyclic Workshop collections, safe Lua,
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
  The public 1.4.0 publication archive was also installed and upgraded to 1.5.0
  in all three variants, checking reconstruction of the changed route patches
  and the targeted scan/cache/pre-start/socket route, file and job integrations.
- Stock native frontend: full TypeScript, targeted ESLint and production webpack
  build were rerun for 1.5.0. Prior 1.3.0 Arix before/after type comparisons introduced zero errors; full Arix
  compilation is not claimed because the root dependency set omits theme
  dependencies (92/100 existing baseline errors). The live host must retain its
  existing matched frozen theme dependencies.
- Standalone publication: SDK export and a GitHub-shaped archive of the pushed
  addon-only root commit are imported through the matching SDK, validating root
  discovery, identity and declared bytes. Source/root/SDK payload equality and
  the SDK checksum are verified. Remote commit identity is checked after push.
  GitHub currently reports private visibility again; the unauthenticated current
  codeload request returned 404. Anonymous download/import validation is deferred
  until the owner makes it public. The earlier public 1.4.0 archive is the actual
  previous-release input used for upgrade tests.
  Publication: ad93274d69eeecb63591af233496212dc0185857.

## Live checks still outside this environment

Test the generated Lua and FastDL downloads in a real GMod client, and exercise
actual Wings responses and the installed theme's frozen build on a disposable
copy of the intended hosting installation. Tests here use fake Wings/Steam
responses and synthetic DB records; they do not establish live Steam or game
behavior. The package uses the Panel's existing queue and Python 3;
there is no separate node service or container-side installation to validate.
The GMA format follows Facepunch/gmad's writer, metadata and whitelist sources.
Steam acceptance/visibility/moderation, customer authentication, collection edits
and actual game-client Workshop downloads are not asserted by local archive tests.
The Panel exports a publishing package; it does not perform those Steam actions.

Scanner validation also needs a representative, licensed benign/malicious addon
corpus on the intended host before publishing detection-rate claims. No verified
original GBombs sample was available; this release detects documented behavior
rather than making a name-based or hash-based verdict on current reuploads.

Version 1.5.0 targets known paths and does not claim to recursively inspect the
whole container. Manual metadata reuse is an optimization; pre-start checks hash
selected contents and reuse unchanged analysis. The guard covers Panel paths
using the shared power repository and freshly issued guarded websocket tokens.
Existing tokens keep their previous rights until normal expiry, and direct node
starts/auto-restarts or live Lua loads remain outside this point-in-time check.
Propagation detections are static copying heuristics, not observed runtime spread.
See SCAN-RULES.md for the complete boundary and resource policy.
