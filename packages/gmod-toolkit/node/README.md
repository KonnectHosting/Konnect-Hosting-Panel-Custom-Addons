# Node FastDL companion

Install this once on each **Wings node** where FastDL is offered, independently
of the Panel addon. No Addon Manager or Proxmox changes are needed on nodes.
Requires Linux, Python 3.11+ with its standard `bz2`/SQLite modules, systemd, and
an HTTPS web server at the node's FQDN on port 443. This does not require another
process inside each game container.

The Panel owns customer authentication and permissions. It signs requests to the
companion using a separate 256-bit API key for each node. Timestamps and durable
single-use nonces reject replay. The listener binds only to 127.0.0.1:8099.

1. After enabling the Panel addon, open **GMod Toolkit** in Addon Manager's admin
   extensions. Enable the actual GMod eggs. Select a node, verify its Wings
   volume directory, and download `config.json`. It contains a private API key.
2. Transfer this directory and that config to the Wings node. As node root:

   ```sh
   install -d -m 0755 /opt/gmod-toolkit
   install -d -m 0700 /etc/gmod-toolkit /var/lib/gmod-toolkit
   install -m 0644 gmod_toolkit_agent.py /opt/gmod-toolkit/gmod_toolkit_agent.py
   install -m 0600 /path/to/downloaded/config.json /etc/gmod-toolkit/config.json
   install -m 0644 gmod-toolkit.service /etc/systemd/system/gmod-toolkit.service
   python3 -c 'import bz2, sqlite3'
   ```

   If Wings uses a different volume directory, set it in the downloaded config
   and replace `ReadOnlyPaths` in the unit with the same actual path. The volume
   root must be the parent of server UUID directories, not `/home/container`.
   Published data must stay outside all customer-writable volumes.
3. Add the two locations in `nginx-locations.conf` to the node FQDN's existing
   HTTPS virtual host. The existing certificate must cover that node hostname.
   If Wings currently terminates TLS directly on 443, first configure a reverse
   proxy for its existing routes; do not replace Wings' listener blindly. Nginx
   configuration depends on the node's current listener/certificates and is not
   installed automatically by the Panel package.
4. Check and start:

   ```sh
   nginx -t
   systemctl daemon-reload
   systemctl enable --now gmod-toolkit.service
   systemctl reload nginx
   ```

5. Use a customer's GMod Toolkit tab to preview and publish. The resulting URL
   is `https://<node.fqdn>/fastdl/<random-64-hex-token>/`. Put it in the actual
   Source setting `sv_downloadurl` in `garrysmod/cfg/server.cfg`. Each server has
   its own token; server UUIDs and disk directories are kept internal.

Only maps (.bsp/.nav/.ain), materials (.vmt/.vtf), model assets
(.mdl/.vvd/.vtx/.phy/.ani), sound (.wav/.mp3/.ogg), particles (.pcf), and resource
fonts (.ttf/.otf) are eligible. Lua, configuration files, hidden files, names
marked secret/private/password, archives (including .gma/.vpk), executables,
symlinks, hard links, and special files are excluded. All source paths are opened
relative to a trusted directory descriptor with `O_NOFOLLOW` on every component.
Workshop archives are not unpacked or published. Assets inside `addons/` must
be intentionally extracted into the normal game asset directories first.

Previews hash every eligible file. Publication checks those hashes again, writes
a new private generation, and atomically switches the download mapping only on
success. Source edits require a fresh preview. Old publications survive failed
builds. Python's streaming bzip2 writer creates `.bz2` assets; raw copies remain
available for clients that fall back to uncompressed downloads. There is no
directory listing or generic file proxy. Resource limits: 128 MiB/file, 2 GiB
uncompressed/server, 5000 files, 20,000 inspected entries, 25-second preview,
15-minute publication, and four concurrent operations. Disk usage can reach
roughly four times the current raw asset size while replacing a generation.

Rotate invalidates the old token and requires updating server.cfg. Revoke
invalidates the token and cancels pending publications via a revision check.
Already-downloaded files cannot be recalled. Public URLs are public to anyone
who knows them. Revoke publications before disabling/deleting the Panel addon
if you want downloads stopped: the separate node companion continues serving
published snapshots until revoked or stopped. Schema, settings, backups and
node data survive addon disable/delete. Removing a game server or suspending it
does not automatically revoke its FastDL URL in version 1.0; revoke explicitly.

The companion runs as node root with only `CAP_DAC_READ_SEARCH` so it can read
Wings volumes across ownership boundaries. systemd makes the system/volumes
read-only and permits persistent writes only under `/var/lib/gmod-toolkit`.
The API accepts fixed operations and UUIDs, never shell commands, mount paths
or user-provided URLs. Keep the configuration and state private. The signed API
must remain reachable from the Panel; there is no root SSH access from the addon.

To stop public serving immediately: `systemctl stop gmod-toolkit.service`.
Keep `/var/lib/gmod-toolkit` to retain published data and tokens. To replace a
compromised node key, stop the service, replace the matching private key in both
the Panel's private settings and node config using operator-controlled access,
then restart. Do not publish either configuration file in GitHub.
