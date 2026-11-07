# Backdoor Scanner: rules, research and limits

Rules version: **2026.11.07.2**. Reviewed 2026-11-07. This implementation and its
synthetic regression corpus were written for GMod Toolkit; no third-party scanner
or malware payload is executed or installed. The scanner needs no Steam key,
node service, Proxmox change or game-side Lua installation.

## Research references

- [Will Donohoe, Workshop Backdoors (2014)](https://will.io/blog/2014/01/07/workshop-backdoors/):
  primary historical description of the Screen Grabber incident, hidden receiver,
  aliased network API and network input executed as Lua. The documented `bdsm`
  channel is an indicator, never a substitute for examining its callback.
- [mTxServ: detect/remove a GMod backdoor](https://www.mtxserv.com/help/gmod/how-to-detect-and-remove-a-backdoor-on-gmod):
  administration abuse and scanner false-positive examples. A SteamID or global
  reference alone does not establish malicious intent.
- [Facepunch: Net Library Usage](https://wiki.facepunch.com/gmod/Net_Library_Usage):
  server receiver/sender trust boundary and authorization guidance.
- [Backdoor Shield scanner definitions](https://github.com/Xalalau/backdoor-shield/blob/master/lua/bs/server/definitions/filescanner.lua)
  (reviewed Git blob `17b623386d345437af9ad9bbd73f128d62258b2d`) and its
  [README](https://github.com/Xalalau/backdoor-shield): relevant file extensions,
  API combinations and the need to handle benign uses/DRM carefully. These were
  research references; its implementation, weighting and folder whitelists were
  not imported.
- [Historical receiver-name observations](https://github.com/mosgorzdrav/exechackapi/blob/main/sollyexp3.lua):
  a read-only reference for several longstanding channel names. No exploit or
  scanner from that repository is installed or run. This addon uses a small
  explicit name set, restricted to registered receivers/network strings, not
  generic terms such as `web`, `file`, `rcon`, or every string in that reference.
- [GBombs 5 historical context](https://gmod.fandom.com/wiki/Garry%27s_Bombs_5) and
  [the fixed reupload's description](https://steamcommunity.com/sharedfiles/filedetails/?id=897138102):
  provenance matters. No rule labels an addon malicious because it is called
  GBombs or contains a creator credit. Fixed copies must not inherit a verdict
  from a different historical version. No verified original GBombs sample/hash
  corpus was available in this environment; detection is behavior-based.
- [Facepunch/gmad](https://github.com/Facepunch/gmad): archive format reference.
  The original synthetic GMA fixtures independently check archive/member
  boundaries and per-member CRC handling.

## Detection behavior

| Rule/family | Priority | Evidence and interpretation |
| --- | --- | --- |
| `network-execution` | Critical for direct nesting; high for simple assignment association | Network-read input reaches a Lua executor, including aliases and protected calls. An exposed server receiver may permit remote control. |
| `remote-handler-execution`, `http-execution` | High | A command/network or web callback contains execution APIs, or the executor is the HTTP callback. Callback co-occurrence is heuristic; authorization and exact flow still need review. |
| `identity-privilege`, `identity-bypass` | High | Fixed Steam identity near a privilege grant or allow decision. Intentional whitelists can match. |
| `remote-privilege`, `authorization-override` | High | Remote callbacks alter administration, or admin/permission functions are replaced. Merely seeing an admin check does not prove it protects the actual sender. |
| `privilege-change`, `privilege-table-write`, `admin-command` | Medium/high | Administration APIs, direct rank-table writes and admin console commands. These legitimately occur in administration frameworks. |
| `indirect-execution`, `encoded-loader`, `encoded-payload` | High | Indexed/encoded executor, decoding alongside execution, or bounded literal Base64 containing sensitive APIs. Literal inspection never evaluates Lua. |
| `code-propagation` | High | Script reads feed file writes, or source introspection appears with copying. Review destinations/loops; installers and backups can match. This is not runtime monitoring. |
| `file-execution`, `persistent-write` | High/medium | Files feed execution or code changes script/privilege paths. Review file provenance and who can write it. |
| `possible-exfiltration`, `console-execution`, `native-execution` | High | Potential credentials/configuration in HTTP arguments, sensitive/network-derived console commands, or native/OS interfaces. Legitimate integrations can match. |
| `historical-channel` | High receiver / medium registration | Exact small historical name set; names can be reused by legitimate/protection addons. References in comments or unused string lists are not flagged. |
| `dynamic-lua`, `native-module`, `hidden-unicode` | Medium | Dynamic compilation, additional modules or invisible/directional characters. Review context rather than treating them as malware signatures. |
| `environment-access`, `http-request` | Low, hidden by default | Common globals/debug access and ordinary HTTP requests. These alone are weak indicators. |

The lexical pass understands GLua/Lua comments, quoted strings and long brackets.
Only bounded literal concatenation, escaped bytes, `string.char` and
`string.reverse` are folded. Simple API aliases and direct assignments are
tracked. This is **not** a complete Lua AST, scope analyzer, symbolic executor,
or general taint engine. Function shadowing, reassignment, complicated tables,
dynamic encodings, metaprogramming and cross-file flows can mislead it. Severity
is review priority, not a claim of confirmed malware or measured probability.

## Targeted scope and resource limits

The default scans only loose code below:

- `/garrysmod/lua`
- `/garrysmod/addons`
- `/garrysmod/gamemodes`
- `/garrysmod/data`
- `/garrysmod/cfg`
- `/garrysmod/materials`

Metadata for ancestor paths is read to reject symlinks; this never becomes a
container-wide recursive search. Top-level map/model/sound/particle/resource/
screenshot/asset trees inside unpacked addons and gamemodes are pruned. Lua
folders with those names are retained. Material VMT files remain in scope.
`.git` and `node_modules` trees are excluded. FastDL, backups, game engines and
arbitrary custom root folders are not visited. A 60–100 GB server is not rejected
because of its overall size; only selected file transfers consume scan budgets.

**Optional packed mode**, off by default, also reads GMA files in those folders
and the known caches `/garrysmod/cache/srcds`, `/garrysmod/cache/workshop`,
`/steamapps/workshop/content/4000` and `/steam_cache`. Only known Workshop/numeric
item layouts within `steam_cache` are traversed; cached full-game installations
are excluded. Cache roots are archive-only. Packed addons found in a default
loose-code scan are reported as excluded, not silently called clean.

Wings' existing file API streams entire files, not selected GMA members. Packed
mode therefore transfers the archive's assets too. It runs **after loose code**,
with a separate 4 GiB transfer budget; the default loose-code budget is 512 MiB.
Budgets count attempted reads, not total server capacity. Findings already
collected survive quota/discovery limits. Loose files are processed while their
folders are discovered; there is no collect-everything-first failure.

- Text types: `.lua`, `.txt`, `.cfg`, `.vmt`, `.json`, `.dat`, `.js`. Packed mode:
  GMA v1/v2/v3 and LZMA-alone `.gma` / Workshop-cache `.bin` inputs. No paths are
  extracted. Other containers, native code and bytecode remain uninspected.
- 2 MiB per text/member; 1 GiB per raw/expanded archive; LZMA dictionary capped at
  64 MiB; archive table capped at 50,000 entries; archive analysis capped at
  5,000 text members / 64 MiB. Helper CPU/memory/wall limits remain enforced.
- Scan caps: 50,000 candidates, 100,000 selected-directory entries, 10,000
  directories, path/depth bounds and 2 hours. Preserve at least 1 GiB Panel free
  space. Quotas retain partial results and explain what was not inspected.
- Retain the highest-priority findings: 30 per helper invocation, 500 per report,
  and 200 coverage details. Unapproved findings take precedence over approved
  file versions. Report truncation never clears the pre-start count of new
  high/critical findings. Static detection has false positives and false negatives.

## Incremental results and approvals

Private per-server, per-path caches store source SHA-256, metadata, the rules/
scope version and static analysis output. Normal manual scans reuse records
when size and modification time match. The content-recheck option downloads and
hashes selected files even if metadata is unchanged, and reuses analysis when
bytes match. Metadata-only reuse is an optimization, not a tamper-proof claim:
SFTP or another process can preserve timestamps. Cache slots are bounded to
50,000 per server; uncached files are still inspected. Deleted files disappear
from the next report. Rules/scope changes invalidate cached analysis.

Explicit approvals require existing file-read/create/update permissions and a
completed report containing that exact file/SHA-256. They apply to the whole file
(or whole GMA), not just one shown line. Content changes or detection-rule updates
invalidate the approval. Read-only users cannot approve code or cancel another
user's preflight scan. Approvals are private and record actor/time; no game file
is rewritten. Starting a new scan replaces the latest report, not the cache.

## Checks before Panel power actions

The shared Panel Wings power repository intercepts GMod start/restart requests,
including normal client/API, administrator and scheduled operations using that
repository. The request queues a guarded check; it never forwards power first.
The requesting actor's current power permission, server eligibility/state, nonce,
cancellation marker and expiry are checked again before sending the action.

Power checks always re-read/hash selected content, even when timestamps are
unchanged; unchanged **analysis** is reused. Thus CPU-intensive detection is run
for new/changed contents rather than exhaustively repeated for every file.
The last manually selected packed-mode setting applies. Packed mode is still
optional and expensive; its exclusions are not a guarantee about unscanned code.

A completed selected-scope check with no unapproved high/critical findings and no
blocking inspection errors sends the requested action once. Findings needing
review, unreadable selected code, lost permissions, queue failures, cancellation,
replacement or expiry hold it. Review/correct the file, or explicitly approve its
exact version, then request start/restart again. Intentional out-of-scope formats
are listed separately; they are not treated as successful malware inspection.
Stop/kill cancels a queued start. An explicit Cancel queued start button also
works while the game is offline and its normal Stop button is disabled.

Normal Panel power buttons use the Wings websocket. For eligible GMod servers,
fresh websocket tokens carry a marker and omit direct power permissions; owner
`*` permissions are expanded to equivalent known non-power permissions, while
existing admin flags are retained and subuser privileges are never expanded.
The shared socket client (also used by Arix) forwards those power actions through
the normal authenticated Panel API. Console/log/stat traffic is unchanged.
Other eggs retain their original permissions and transport. Disabling/deleting
the addon restores the exact native source fragments.

Reload the Panel after updating. Existing tokens issued before the update may
retain their old rights until their existing 10-minute expiry. Direct node/API
administrative starts, Wings crash/boot auto-restarts and code loaded while GMod
is already running are outside this Panel-only guard. A scan is a point-in-time
review, not an atomic filesystem lock, runtime sandbox or live malware monitor.
Concurrent file changes and sophisticated dynamic/cross-file behavior can evade
it. The propagation rule identifies suspicious copying patterns; it does not
observe or prove a running infection spreading.

Rules ship with addon releases. There is no downloaded executable threat feed,
payload fetching, account reputation lookup or automatic name whitelist. Tests
use synthetic code/archive data, actual Laravel/queue code and mocked Wings;
they do not establish representative real-world malware detection rates or
live 100 GB server performance.
