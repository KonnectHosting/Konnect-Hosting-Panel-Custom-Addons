# GMod Toolkit 1.0.0

Neutral Addon Manager package for Panel 1.15.1, manager 2.0.1 and PHP 8.2/8.3.
Arix is optional. Uses declared native Panel route/frontend patches and the
manager's `panel-v1` frontend build, so the host needs its matching frozen
frontend dependencies and working isolated build runner.

After installation, open GMod Toolkit in the manager's admin extension menu and
enable your actual GMod eggs. Customers use the **GMod Toolkit** server tab.
The expected game directory is `/home/container/garrysmod`.

Workshop accepts a Steam collection ID or steamcommunity.com collection
link, resolves nested GMod collections, removes duplicate references and cycles,
and previews the resolved items, additions/removals, current Lua and replacement.
Apply writes only `garrysmod/lua/autorun/server/gmod_toolkit_workshop.lua`.
The 20 most recent previous versions are backed up privately on the Panel;
select a backup to preview and restore it. Previews are bound to a user/server,
expire after 15 minutes, and reject changes to the target file. Unavailable,
private, non-GMod or oversized collections fail without applying partial Lua.
Public Steam metadata is fetched from Valve's fixed HTTPS API endpoints without
an API key. Steam availability/rate limits affect preview creation.

This Lua requests **client** Workshop downloads. Configure **server** mounting
separately using the egg's editable Workshop collection startup variable or
`+host_workshop_collection COLLECTION_ID`. The UI shows the exact collection
argument. Startup and Steam API credentials are not modified, stored in Lua, or
published. Restart the game server when ready after applying client Lua.

FastDL uses the server's node FQDN, for example
`https://na1.konnecthosting.com/fastdl/<random-token>/`. The companion node
publisher must be installed once per Wings node using the separate `node/`
instructions from this addon's source repository. The Panel addon does not
install host services or alter Proxmox. Download its private per-node config
from the admin extension page, install the companion on the node, and add its
Nginx locations to the node's HTTPS virtual host. Existing Wings routes remain.

Customers preview eligible asset changes and explicitly publish them publicly.
The node produces `.bz2` and raw copies, then switches the published snapshot.
The UI gives a ready-to-copy `sv_downloadurl` configuration. Rotate or revoke
the random per-server URL from the same tab. Raw UUIDs and container directories
are not used as public download roots. Lua, configs, secrets, addon archives,
links and special files are excluded; only named game asset extensions qualify.
No automatic GMA extraction or Workshop archive publishing is performed.
FastDL serves files requested by the game; custom resources may still need
`resource.AddFile` registration in private server Lua. The addon does not publish
that Lua or assume every published asset should be forced onto every client.

Customers need `file.read` AND `file.read-content` for previews/status, and also
`file.create` AND `file.update` for all changes, including public publishing,
rotation and revocation. Existing owner/admin and per-server membership checks,
CSRF/session authentication, two-factor checks and suspension checks are retained.
The tab may appear on other games, but the server API only permits configured
GMod eggs. There is no new invented client permission string.

Private settings/backups live in `storage/app/gmod-toolkit`. Node snapshots live
in `/var/lib/gmod-toolkit`, outside game volumes and public web roots. Disable or
delete removes addon routes/frontend through manager reconstruction and retains
private data. Public serving is a separate node service: **revoke public URLs
before disabling/deleting the addon or game server** if serving must stop.
Suspension does not automatically revoke published snapshots in this version.
Updates keep the same addon ID and private storage. Retained state uses only
additive/optional fields; no destructive database migrations are included.

The source repository includes SDK export tooling, executable tests, the node
companion and full operational instructions. No live deployment is performed by
building or exporting this package. Host-specific TLS/listener setup and a live
Panel/Wings/GMod smoke test are required before offering it to customers.
