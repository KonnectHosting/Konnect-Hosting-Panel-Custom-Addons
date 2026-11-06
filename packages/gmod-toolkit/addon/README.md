# GMod Toolkit 1.2.0

One self-contained addon for Addon Manager 2.0.1, Panel 1.15.1 and PHP 8.2/8.3.
Install the public package-folder URL in the manager's Install addon dialog.
GMod eggs are recognized automatically by egg name or the trusted `-game garrysmod` startup template. Optional admin settings support custom egg names.
Customers have separate **FastDL** (`/fastdl`) and **Workshop** (`/workshop`)
server pages. On Arix, remove the old GMod Toolkit sidebar entry and add both
new routes from the Editor's Missing Links list to your conditional Garry's Mod
category, then save. The old `/gmod-toolkit` bookmark redirects to Workshop.

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

Workshop handles Steam's collection response without depending on
the optional file-details type field. It also uses Laravel's dispatcher contract
with the manager's native guarded job wrapper, avoiding the installed manager's
missing `bus` binding. No manager update is needed. Scan status reports inspected
entries and remaining folders; delayed workers are identified and expired work
can be retried instead of remaining running forever.

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
