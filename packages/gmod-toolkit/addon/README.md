# GMod Toolkit 1.1.0

One self-contained addon for Addon Manager 2.0.1, Panel 1.15.1 and PHP 8.2/8.3.
Install the public package-folder URL in the manager's Install addon dialog.
GMod eggs are recognized automatically by egg name or the trusted `-game garrysmod` startup template. Optional admin settings support custom egg names.
Customers then open the GMod Toolkit server tab.

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

The UI provides the actual `sv_downloadurl` setting for server.cfg. FastDL hosts
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
Existing queue/scheduler services provide recovery; duplicate/stale queue steps
are ignored. Each step handles one directory or one asset. Limits: 128 MiB/file,
2 GiB raw/server, 5000 files, 20,000 inspected entries, 4 MiB directory responses,
one hour per preparation/publication, and 15 minutes to approve a finished
preview. A 1 GiB free-space reserve protects the Panel. Compression has independent CPU/memory/time limits. Expired private
previews are cleaned automatically. Previous publications survive failed builds.

This is a native Panel frontend package using the manager's panel-v1 profile.
It adds no package-manager dependencies. The host must already have the working
Panel queue/scheduler and its matched frozen frontend dependencies. See the
source repository's verification record for executed tests and live-game checks.
