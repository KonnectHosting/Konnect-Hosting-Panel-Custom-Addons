# GMod Toolkit 1.5.0

One self-contained addon for Addon Manager 2.0.1, Panel 1.15.1 and PHP 8.2/8.3.
Install the public package-folder URL in the manager's Install addon dialog.
GMod eggs are recognized automatically by egg name or the trusted `-game garrysmod` startup template. Optional admin settings support custom egg names.
Customers have separate **FastDL** (`/fastdl`), **Workshop** (`/workshop`) and
**Backdoor Scanner** (`/backdoor-scanner`) server pages. On Arix, remove the old GMod Toolkit sidebar entry and add the
new routes from the Editor's Missing Links list to your conditional Garry's Mod
category, then save. The old `/gmod-toolkit` bookmark redirects to Workshop.

Backdoor Scanner checks known code locations: `/garrysmod/lua`, `addons`,
`gamemodes`, `data`, `cfg` and `materials`. It never recursively searches the
container root, FastDL, backups or engine trees. Asset-only map/model/sound/
particle/resource/screenshot trees in addons and gamemodes are pruned; relevant
material files remain included. It reads .lua/.txt/.cfg/.vmt/.json/.dat/.js.
Loose files are inspected as directories are discovered, so later limits do not
discard all progress. Overall server disk usage is not a scan-size limit.

Packed addons are optional, off by default, and run after loose code. They include
GMA and LZMA-alone Workshop archives from installed addon folders and the known
`garrysmod/cache/srcds`, `garrysmod/cache/workshop`,
`steamapps/workshop/content/4000` and `steam_cache` locations. Cache traversal is
limited to archive layouts, not full game installations. Existing Wings streams
the whole archive, including assets, so this option can be expensive. Excluded
packed files are identified in the report, not silently approved.

Results include severity, path/member, line/context, rules and explanations.
Private caches reuse unchanged analysis; new/modified files are checked on the
next scan. Manual scans normally use size/mtime for reuse; the content-recheck
option verifies bytes too. Cache and approval versions change with rules.
Source contents never run as part of analysis. Potential copying/self-propagation
patterns are reported, alongside HTTP/network execution, privilege changes and
other documented indicators. This is a heuristic tool, not a runtime monitor or
guarantee. Legitimate administration/DRM can match; findings require review.

Panel start/restart requests automatically queue a selected-code check before
Wings receives power. Start checks always hash selected contents, catching edits
with preserved timestamps, while reusing analysis for unchanged bytes. New
unapproved high/critical findings or blocking inspection errors hold the start.
An operator with file read/create/update permissions can approve an exact file
version after review, or correct/remove the suspect code, then request start
again. Changed contents or rule updates require fresh review. Read-only users
cannot approve files. Stop/kill and Cancel queued start cancel pending requests.

Normal and Arix power buttons use the shared websocket bridge, which sends GMod
power actions through the authenticated Panel API. Fresh GMod websocket tokens
cannot issue power directly; non-GMod permissions/transport are retained.
Reload the Panel after updating. Existing tokens may retain old rights for up to
10 minutes. Direct node/API administrative starts, Wings boot/crash auto-restarts
and live Lua loads on an already-running server are outside this guard. The scan
is not an atomic filesystem lock or live prevention agent. No game-side code,
node daemon or Proxmox edit is installed by the scanner.

Limits apply to selected transfers, not server capacity: 512 MiB loose code plus
a separate 4 GiB optional packed budget; 2 MiB/text file, 1 GiB/archive including
expanded data, 50,000 candidates and 2 hours. Archives have bounded member/analysis
limits. Quotas retain partial findings and explain uninspected inputs. Native
binaries, bytecode, unsupported formats, symlinks and unreadable/changed files are
reported. At most 500 priority findings and 200 coverage details are retained;
truncation is shown. Private caches are bounded to 50,000 file slots per server.
Zero findings does not prove a server is safe. Reports/cache data are private
and survive page reloads. No file is automatically deleted or changed.

Workshop shows a responsive collection grid with the actual Steam thumbnail,
title, description, download size, subscriber count and update date for each
addon. Metadata can be unavailable; the UI labels missing values and uses the
bundled generated cover as a fallback. Each customer's collection input is saved
for that server automatically after a short pause or leaving the field. Opening
the page fetches fresh Steam metadata; **Refresh collection** does the same
manually. Steam failures keep the last gallery and show a retry message.
Selection preferences are separate from the server's applied Lua and are private
to each customer/server. Existing applied collections seed the initial selection
on upgrade. Clearing the field clears the preference. Viewing, saving or refreshing
a selection never creates a Lua preview or writes a game file. Use **Preview
download Lua**, then Apply, to change the server file. Steam artwork loads directly in the browser from trusted HTTPS CDN
hosts; no arbitrary image proxy is exposed.

Workshop accepts Steam collection IDs/links, resolves nested GMod collections,
removes duplicate/cyclic references and previews the item list, changes, old Lua
and generated Lua. Apply writes only
`garrysmod/lua/autorun/server/gmod_toolkit_workshop.lua` using the existing Wings
file API. The 20 most recent previous versions are retained privately on the
Panel and can be previewed/restored. Previews belong to the requesting user and
server, expire after 15 minutes, and reject edits to the target file. Private,
unavailable and non-GMod Workshop items fail without applying partial Lua.

Workshop generates client-download Lua only. The server-mounting section and
Startup link have been removed. Steam credentials are never included in generated
Lua or public downloads.

FastDL is hosted on the **Panel** at
`https://YOUR-PANEL/fastdl/<random-per-server-token>/`. The addon uses existing
Wings APIs to create a private asset snapshot through the Panel's existing queue.
The completed preview shows added/changed/removed files before publication.
Publishing compresses the exact approved snapshot into `.bz2` files, retains raw
fallbacks and switches the public generation only when every file succeeds.
Later live source edits do not change an already-approved snapshot. To publish
new bytes, create another preview. URL rotation and revocation are built in.

FastDL reads only the dedicated **`/home/container/fastdl/`** upload directory.
On the FastDL page, click **Prepare upload folders** to create this layout through
the Panel's existing Wings file connection:

```text
fastdl/
  maps/
  materials/
  models/
  sound/
  particles/
  resource/fonts/
```

Upload extracted files using Files or SFTP, preserving game-relative names.
For example, `fastdl/maps/rp_example.bsp` becomes `maps/rp_example.bsp` under
your public download URL. Folder preparation is idempotent and does not overwrite
uploads. Game assets under `garrysmod/` are never scanned, moved or copied by
FastDL. Files inside `addons/` or archives are not unpacked or published.
Do not precompress files; the addon creates `.bz2` copies when publishing.
The UI links directly to `fastdl/` and to the server.cfg folder.

When updating from an older version, existing publications and their URLs remain
available. Unfinished previews from the previous source location are retired;
create a fresh preview using the dedicated `fastdl/` folder. Private Workshop
backups are preserved.

Click Preview FastDL changes, review the completed snapshot and publish it.
Your unique URL appears after the first successful publication, with buttons
to copy the URL and the `sv_downloadurl`/`sv_allowdownload`/`sv_allowupload`
settings for `/garrysmod/cfg/server.cfg`. Save the settings and restart the game
server, or apply the settings in its console now. Repeat preview/publication
after source changes. Rotating the URL requires updating server.cfg again.

## Choose FastDL or Workshop delivery

The FastDL page guides customers through upload, private preview, delivery choice
and game configuration. Publishing FastDL compresses only the approved snapshot.
**Creating the folder, uploading files and publishing do not enable FastDL in
the game. Customers must set `sv_downloadurl` in server.cfg**, save it and reload
the settings/restart the game server. The tool never writes server.cfg. Optional
resource.AddFile calls can be copied from the preview; their paths contain
neither the fastdl/ prefix nor the .bz2 suffix.

Alternatively, choose **Steam Workshop addon** after preparing a preview:

1. Choose the addon name and description. Upload a JPEG, PNG or WebP cover, or
   keep the generated default. The browser crops the cover to a 512 × 512 JPEG.
2. Build the package. No FastDL publication is required. The existing Panel queue
   verifies the private snapshot and builds a real CRC-checked GMAD v3 addon.
3. Download the private ZIP containing `addon.gma`, `preview.jpg`, `addon.json`,
   `description.txt` and `PUBLISHING.txt`. Only the creator with current file
   permissions can download it. It expires after one hour; a new preview replaces it.
4. Extract the ZIP on your PC and use Garry's Mod's **gmpublish** tool while
   signed into your own Steam account. Publishing instructions are included.
5. Add the published item to your Steam collection, reload that collection in
   the Panel Workshop page, review/apply its client-download Lua and restart the
   game server. Players then download that addon through Valve's CDN.

The Panel performs packaging. Steam upload and collection editing occur in the
customer's Steam account; the Panel never collects Steam passwords, sessions or
Steam Guard codes. Choosing Workshop does not change existing FastDL settings.
To use Workshop alone, the customer can clear their old sv_downloadurl setting
once their Workshop downloads are working.

GMA paths are lowercased to match the official publishing tool. Case collisions,
empty assets and files outside the GMod publisher's whitelist fail with an
explanation instead of producing a broken package. In particular, Workshop
fonts must be .ttf under resource/fonts/; .otf and unused .sw/.360/.xbox.vtx
variants cannot be exported. Failed builds preserve existing FastDL publications.
The incremental writer processes one asset per queue step and retries safely
without duplicating bytes. It needs only the existing Python 3 standard library.

FastDL hosts
resources requested by the game; custom assets may also need `resource.AddFile`
registration in private server Lua. Only maps, materials, models, sounds,
particles and resource fonts with approved extensions are eligible. Lua, cfg,
hidden/sensitive filenames, archives (including GMA/VPK), special files and
reported symbolic links are excluded. There is no live-directory alias or
arbitrary public file proxy. Assets in addon archives are not unpacked.

All runtime code is in this addon. There are no node daemons, node API keys,
node web-server changes, game-container installers or Proxmox changes. The
existing Panel Python 3 runtime supplies standard-library bzip2 compression;
the bounded helper is part of the addon, not a separate installation. The Panel
uses its own disk and bandwidth for snapshots and public downloads.

Customers need `file.read` AND `file.read-content` for previews/status, plus
`file.create` AND `file.update` for changes. Queue steps recheck the actor's
current permissions and server state. Authentication, session CSRF, two-factor
and per-server membership middleware are retained. Public routes serve only
approved immutable snapshot objects and require the addon to remain enabled.
Suspended/deleted servers and disabled eggs stop public downloads immediately
on the next request. Rotated/revoked URLs fail on the next request too.

Private state is retained in `storage/app/gmod-toolkit` on disable/delete.
Removing the addon reconstructs its routes/frontend through the manager; no
separate service remains. Re-enabling may resume retained valid publications.
Existing queue/status polling and queue retries provide recovery; duplicate/stale queue steps
are ignored. Each step handles one directory or one asset. Limits: 128 MiB/file,
2 GiB raw/server, 5000 files, 20,000 inspected entries, 4 MiB directory responses,
one hour per preparation/publication, and 15 minutes to approve a finished
preview. A 1 GiB free-space reserve protects the Panel. Compression has independent CPU/memory/time limits. Expired private
previews are cleaned automatically. Previous publications survive failed builds.

This is a native Panel frontend package using the manager's panel-v1 profile.
It adds no package-manager dependencies. The host must already have the working
Panel queue and its matched frozen frontend dependencies. See the
source repository's verification record for executed tests and live-game checks.
