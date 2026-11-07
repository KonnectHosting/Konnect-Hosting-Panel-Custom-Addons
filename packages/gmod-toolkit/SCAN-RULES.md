# Backdoor Scanner: rules, research and limits

Rules version: **2026.11.07.1**. Reviewed 2026-11-07. This implementation and its
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

## Scope and operational limits

- Discover server-visible folders recursively. Root platform/runtime trees
  (`bin`, `bin64`, `linux32`, `linux64`, `platform`, `sourceengine`, `hl2`,
  `steamcmd`, `.steam`) and `.git` directories are excluded. This covers usual
  `garrysmod/addons`, `garrysmod/lua`, gamemodes/data, Workshop content and caches,
  plus custom folders outside those excluded trees. Files mounted outside what
  Wings exposes cannot be inspected by this Panel-only addon.
- Inspect `.lua`, `.txt`, `.cfg`, `.vmt`, `.json`, `.dat`, `.js`, `.gma`, and
  Workshop/cache `.bin` containers. Inside GMA, inspect the relevant text members
  without extracting paths. Arbitrary image/model/map binary payloads are not
  exhaustively searched; code loading their contents may be detected in Lua.
- GMA v1/v2/v3 and LZMA-alone are supported. Other compression/container formats,
  nested archives, native modules and Lua bytecode are explicitly uninspected.
- 2 MiB per text/member; 1 GiB per raw or expanded archive; LZMA dictionary memory
  capped at 64 MiB; archive table capped at 50,000 entries; archive text capped at
  5,000 members / 64 MiB. The helper also has CPU, memory and wall-clock limits.
- Scan caps: 4 GiB transfers, 20,000 candidates, 100,000 directory entries,
  10,000 directories, path/depth bounds and 2 hours. Preserve at least 1 GiB Panel
  disk space. Temporary inputs are private and removed after processing; archive
  decompression uses an anonymous temporary file. Server file contents never
  become public FastDL downloads.
- Retain the highest-priority findings: at most 30 per helper invocation, 500 per report and 200
  coverage explanations. A limit, unreadable/changed file, invalid archive,
  symlink, bytecode or unsupported format produces explicit incomplete coverage.
  Do not interpret zero findings or an incomplete scan as “clean.”
- Files are inspected at different times. This is not an atomic snapshot or
  running-server protection. Newly downloaded code or later edits require a new
  scan. Starting another scan replaces the latest report; download it first to
  keep a copy. No files are automatically removed, quarantined or changed.

Rules ship with a reviewed addon release. There is no live executable threat feed,
remote payload fetching, account reputation lookup or automatic name whitelist.
The current tests use synthetic code/archive data, real Laravel/queue behavior
and mocked Wings transport; they do not establish detection rates against a
representative real-world malicious/benign addon corpus.
