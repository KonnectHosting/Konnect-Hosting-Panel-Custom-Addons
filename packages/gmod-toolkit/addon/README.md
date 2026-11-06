# GMod Toolkit 1.1.2

One self-contained addon for Addon Manager 2.0.1, Panel 1.15.1 and PHP 8.2/8.3.
Install the public package-folder URL in the manager's Install addon dialog.
GMod eggs are recognized automatically by egg name or the trusted `-game garrysmod` startup template. Optional admin settings support custom egg names.
Customers then open the GMod Toolkit server tab.
On Arix, use its Editor's Missing Links list to add the detected GMod Toolkit
route to a sidebar category, restrict that category to the GMod eggs, and save.

Workshop accepts Steam collection IDs/links, resolves nested GMod collections,
removes duplicate/cyclic references and previews the item list, changes, old Lua
and generated Lua. Apply writes only
`garrysmod/lua/autorun/server/gmod_toolkit_workshop.lua` using the existing Wings
file API. The 20 most recent previous versions are retained privately on the
Panel and can be previewed/restored. Previews belong to the requesting user and
server, expire after 15 minutes, and reject edits to the target file. Private,
unavailable and non-GMod Workshop items fail without applying partial Lua.

Client Workshop downloads and server mounting are separate. The generated Lua
contains only `resource.AddWorkshop` calls with validated numeric IDs. Configure
server mounting through the egg's existing Startup collection variable or
`+host_workshop_collection COLLECTION_ID`; the UI links to Startup when permitted.
Steam credentials are never included in generated Lua or public downloads.

FastDL is hosted on the **Panel** at
`https://YOUR-PANEL/fastdl/<random-per-server-token>/`. The addon uses existing
Wings APIs to create a private asset snapshot through the Panel's existing queue.
The completed preview shows added/changed/removed files before publication.
Publishing compresses the exact approved snapshot into `.bz2` files, retains raw
fallbacks and switches the public generation only when every file succeeds.
Later live source edits do not change an already-approved snapshot. To publish
new bytes, create another preview. URL rotation and revocation are built in.

Upload extracted files through the server's Files page or SFTP, preserving paths
under `/garrysmod/maps/`, `/garrysmod/materials/`, `/garrysmod/models/`,
`/garrysmod/sound/`, `/garrysmod/particles/` or `/garrysmod/resource/fonts/`.
These paths are relative to `/home/container`. The UI links to the upload and
configuration folders. Files in `addons/` and archives are not unpacked or
published; upload the extracted public assets to the corresponding folders.
Do not precompress them; the addon creates `.bz2` files when publishing.

Click Preview FastDL changes, review the completed snapshot and publish it.
Your unique URL appears after the first successful publication, with buttons
to copy the URL and the `sv_downloadurl`/`sv_allowdownload`/`sv_allowupload`
settings for `/garrysmod/cfg/server.cfg`. Save the settings and restart the game
server, or apply the settings in its console now. Repeat preview/publication
after source changes. Rotating the URL requires updating server.cfg again.

Version 1.1.2 handles Steam's actual collection response without depending on
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
