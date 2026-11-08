# Backdoor Scanner: rules, research and limits

Rules version: **2026.11.07.3**. Reviewed 2026-11-07. This implementation and its
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
| `network-execution` | Critical for direct nesting; high for simple assignment association; medium for a recognized sender guard | Network-read input reaches a Lua executor, including aliases and protected calls. An exposed server receiver may permit remote control. |
| `remote-handler-execution`, `http-execution` | High, or medium for a recognized sender guard | Command arguments/HTTP response parameters reach an executor, or the executor itself is the response callback. Registration, constant client effects and callback co-occurrence alone do not trigger this rule. |
| `identity-privilege`, `identity-bypass` | High | Fixed Steam identity near a privilege grant or allow decision. Intentional whitelists can match. |
| `remote-privilege`, `authorization-override` | High/medium | Remote callbacks alter administration; a recognized sender guard reduces priority. Defining/replacing an authorization function alone is an optional medium indicator. |
| `privilege-change`, `privilege-table-write`, `admin-command` | Medium/high | Administration APIs, direct rank-table writes and admin console commands. These legitimately occur in administration frameworks. |
| `indirect-execution`, `encoded-loader`, `encoded-payload` | High | Indexed/encoded executor, decoding directly into execution, or bounded literal Base64 containing sensitive APIs. Encoding merely alongside execution is medium. Literal inspection never evaluates Lua. |
| `code-propagation` | High | Script reads feed file writes, or source introspection appears with copying. Review destinations/loops; installers and backups can match. This is not runtime monitoring. |
| `file-execution`, `persistent-write` | High/medium | Files feed execution or code changes script/privilege paths. Review file provenance and who can write it. |
| `possible-exfiltration`, `console-execution`, `native-execution` | High | Potential credentials/configuration in HTTP arguments, sensitive/network-derived console commands, or native/OS interfaces. Legitimate integrations can match. |
| `historical-channel` | High receiver / medium registration | Exact small historical name set; names can be reused by legitimate/protection addons. References in comments or unused string lists are not flagged. |
| `dynamic-lua`, `native-module`, `hidden-unicode` | Medium, hidden by default | Dynamic compilation, additional modules or invisible/directional characters. Review context rather than treating them as malware signatures. |
| `environment-access`, `http-request` | Low, hidden by default | Common globals/debug access and ordinary HTTP requests. These alone are weak indicators. |

The lexical pass understands GLua/Lua comments, quoted strings and long brackets.
All medium/low indicators are hidden by default. A recognized sender guard must
be the first callback statement, check that callback's sender and terminate with
`return` for non-admins. Constant SendLua/BroadcastLua calls alone never establish
remote input flow. The detector does not whitelist addon or command names.

Only bounded literal concatenation, escaped bytes, `string.char` and
`string.reverse` are folded. Simple API aliases and direct assignments are
tracked. This is **not** a complete Lua AST, scope analyzer, symbolic executor,
or general taint engine. Function shadowing, reassignment, complicated tables,
dynamic encodings, metaprogramming and cross-file flows can mislead it. Severity
is review priority, not a claim of confirmed malware or measured probability.

## Targeted scope and resource limits

Only locations selected by the customer are scanned. The default selection is
`/garrysmod/addons` only. Available code roots (or individual descendants) are:

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

**Optional packed mode**, off by default, reads GMA files in selected folders.
Customers can separately select the known caches `/garrysmod/cache/srcds`, `/garrysmod/cache/workshop`,
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
  and 200 coverage details. Higher-priority findings replace weaker findings
  when the report is full. Static detection has false positives and false negatives.

## Incremental manual scans

Private per-server, per-path caches store source SHA-256, metadata, the rules/
scope version and static analysis output. Normal manual scans reuse records
when size and modification time match. The content-recheck option downloads and
hashes selected files even if metadata is unchanged, and reuses analysis when
bytes match. Metadata-only reuse is an optimization, not a tamper-proof claim:
SFTP or another process can preserve timestamps. Cache slots are bounded to
50,000 per server; uncached files are still inspected. Deleted files disappear
from the next report. Rules/scope changes invalidate cached analysis.

Starting a new manual scan replaces the latest report, not the cache. Selection
preferences are remembered in the browser for that server. API requests must
supply a nonempty selection of up to 50 valid files/folders; overlapping folders
are collapsed. Selecting a cache does not select other caches.

## Cancellation, disable and power controls

The scanner has no power hooks, start checks, approval gate, websocket permission
changes or automatic schedule. Startup, restart, stop and kill use native Panel
behavior regardless of scanner state. The 1.5.0 guard is removed during update;
old automatic jobs are retired rather than recovered. Reports generated with old
rules are marked outdated and their findings hidden, with no automatic rescan.

Cancellation uses an atomic job-ID marker outside the worker lock and can be
requested while Wings streams a file or the Python helper runs. Checkpoints stop
work and only the scanner's own helper can be terminated. Pending cancellation
prevents another scan until the old worker releases its input; partial results
remain available. Disabling the server's manual scanner requests cancellation;
enabling it never starts work. Permissions are checked again in queued work.

The scanner is a point-in-time static review. It does not observe a running
infection, stop game-side execution or prove that suspicious copying will occur.

Rules ship with addon releases. There is no downloaded executable threat feed,
payload fetching, account reputation lookup or automatic name whitelist. Tests
use synthetic code/archive data, actual Laravel/queue code and mocked Wings;
they do not establish representative real-world malware detection rates or
live 100 GB server performance.
