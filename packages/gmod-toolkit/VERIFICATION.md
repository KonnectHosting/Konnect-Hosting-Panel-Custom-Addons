# GMod Toolkit 1.6.0 verification

Contract: Addon Manager 2.0.1 source `5a899b28aa80b08f3ab8a5cbae3e5315cc5c2563`,
Panel 1.15.1; PHP 8.3.36 with real locked Laravel dependencies, Debian 12/Python
3.11, Node 22 and Chromium. All runtime data and Wings/Steam transports in the
fixtures are synthetic. No production Panel, node or Proxmox host was modified.

## Checks

- 31 Python rule/archive regressions. The four customer command names, terminating
  sender admin guards, constant BroadcastLua/SendLua effects, unrelated HTTP
  callbacks and reassigned variables do not produce high-priority loader findings.
  Untrusted command arguments and network/HTTP response data reaching executors
  remain detected. Tests also cover aliases, literal obfuscation, historical
  channels, identity grants, persistence, possible copying, native/bytecode
  limitations and bounded GMA/LZMA parsing without extraction or execution.
- 61 real Laravel/Panel integration tests cover Workshop/FastDL, static scanner,
  private storage, permissions and asynchronous queue dispatch. Scanner tests
  exercise exact file/folder selection, mandatory API selections, default Addons
  only, optional archives, exclusion of a synthetic 120 GiB unrelated-asset tree,
  incremental reuse, forced content checks, partial-result budgets, obsolete job
  retirement, outdated findings, cancellation while the worker lock is held,
  cancellation during a read, disable/enable permissions, recovery and expiry.
  Native power repository requests for start/restart/stop/kill go directly to
  mocked Wings even with a scan running. No scanner code controls game power.
- Existing Workshop tests include ID/link parsing, nested/cyclic collections,
  deduplication, Steam-shaped metadata, artwork URLs, saved customer selections,
  Lua preview/apply, stale edits, backups and restoration. Existing FastDL tests
  include dedicated upload folders, approved asset paths, bzip2 round trips,
  immutable snapshots, per-server URLs, public download restrictions,
  rotate/revoke, failures/replays, permission changes and native queued jobs.
  The GMA export tests independently inspect metadata, paths, JPEG covers and CRCs.
- 16 Chromium workflow checks run actual customer components/native Tailwind with
  synthetic HTTP/store/permission adapters: Workshop desktop/mobile gallery,
  artwork, autosave and refresh, FastDL/upload/Workshop export, source escaping,
  mobile overflow, read-only controls, scanner progress/findings/filtering,
  remembered reports, explicit archive selection, specific folder scanning,
  Cancel and Disable/Enable. Opening/refreshing scanner status does not start a
  scan. The actual native shared Websocket class sends four power messages to a
  recording socket adapter without scanner or HTTP interception. No real node
  websocket or customer account is used. No server.cfg writes occur.
- Stock frontend TypeScript, addon ESLint and production webpack build pass.
  A full Arix frontend build is not claimed: the repository root dependencies
  omit its matched theme dependencies. Source lifecycle checks cover all variants.
- SDK lifecycle tests install the actual 1.5.0 addon-only GitHub-shaped archive,
  then update to 1.6.0 on stock Panel, Arix 2.1.3 and Arix Pack 2.0.2 fixtures.
  They verify byte-for-byte restoration of the native power repository,
  WebsocketController and shared Websocket.ts; obsolete guard/bridge files and
  power-check job are removed. Install, further update, disable, re-enable,
  deletion, retained private data and drift rejection also pass. Build/verifier
  callbacks in lifecycle fixtures are test doubles, not isolation attestations.
- The unchanged original Addon Manager 2.0.1 isolated probe boots the addon in a
  networkless/read-only container against an empty temporary SQLite database:
  PHP syntax, Laravel boot, 20 changed PHP files, 3 handlers, 2 extension routes,
  1 page and 0 schedules. The addon does not require a manager validation patch.
- SDK export/import validates manifest discovery, file/fragment checksums and
  package identity. The standalone publication, SDK ZIP and source addon subtree
  contain the same deployable bytes. Anonymous GitHub download/import and remote
  branch identities are checked for the published commit.

## Reproduction

Use disposable destinations only. Prepare Panel/frontend fixtures with
`tools/fixture.py`. Run `tests/panel.php` against a disposable Panel with the
locked Composer dependencies; run `tests/scanner-rules.py` with Python 3 and
`tests/package.php` with the previous 1.5.0 archive. `tests/isolated-probe.py`
requires the prepared vendor directory and a local test Docker image.

Run frontend and browser webpack commands from the frontend fixture directory
so Tailwind discovers the deployed component sources. The browser harness uses
`tests/browser/webpack.cjs` and `tests/browser-smoke.cjs`; screenshots/results are
retained in its disposable output directory.

## Limits of verification

No live 60–100 GB server throughput, representative malware detection rate,
GMod startup/game behavior, real Steam publishing session or customer Panel
installation is asserted. The scanner is a bounded static review tool with false
positives and false negatives. There is no pre-start gate, runtime monitoring,
automatic quarantine, game-side scanner or node service.

## Publication

Addon-only root commit: `0b486601ea42fb7ab027b0e5f99f4ceb7bf8f952`. Anonymous GitHub codeload
downloaded the published archive and the matching SDK imported both that archive
and the SDK ZIP as `gmod.toolkit` 1.6.0. Source, root archive and SDK bytes match.

SDK ZIP SHA-256:

```text
0904737b0ce2d5decad2bb98296fef5407ede165f70f74f662981f72d34f0f7a
```
