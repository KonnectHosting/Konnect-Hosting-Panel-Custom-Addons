# GMod Toolkit

Neutral GMod customer tooling for this repository's **Addon Manager 2.0.1**.
Deployment package: [`addon/manifest.json`](addon/manifest.json), ID
`gmod.toolkit`, version **1.0.0**, Panel **1.15.1**, PHP **8.2/8.3**.
Stock Panel is supported; Arix is optional. See [verification](VERIFICATION.md)
for the tested source variants and the remaining live-host checks.

## Features

- Workshop collection IDs/links, nested collections, duplicate/cycle removal,
  GMod app validation, item/diff/Lua previews, private backups and previewed
  restoration. Client downloads are generated separately from server mounting.
- Node-local FastDL publication: preview and content hashes, streaming `.bz2`
  compression, raw fallback, atomic asset generations, progress, random per-server
  URLs, URL rotation/revocation and resource limits.
- Existing customer/server permissions, membership, authentication, session CSRF,
  two-factor and suspension checks. No invented client extension permissions.
- Strict public asset allowlist. No game-directory alias, Lua/config publication,
  secret/config filenames, addon archives, symlinks, hard links, special files,
  arbitrary fetch URLs or shell execution.

The Panel addon controls Workshop over Wings and signs FastDL API requests. A
small [companion](node/README.md) runs once on each Wings node. It reads that
node's configured volumes and serves copied assets at the **node FQDN**:

```text
https://na1.konnecthosting.com/fastdl/<random-64-hex-token>/
```

The correct game setting is `sv_downloadurl`. The server UUID locates its volume
internally and is not the public token. Published files stay outside game
containers, so downloads work while the game server is stopped. The Addon Manager
remains on the Panel. There are no Proxmox-host changes or remote root installers.

## Install

The SDK ZIP is `dist/gmod-toolkit-1.0.0.zip`, with its `.sha256` sidecar. The
separate `dist/gmod-toolkit-node-1.0.0.zip` contains the node companion and setup
instructions. The addon ZIP contains `manifest.json` at its root; the node files,
tests and development tools are intentionally outside that deployment package.

This development repository is **private**. Manager 2.0.1's URL importer accepts
public GitHub release assets/folders, not private repository links. Do not paste
a private blob/raw link into the Install dialog or make this full repository
public. A public release destination has not been supplied. The exported ZIP can
be installed through the manager's existing local-package CLI instead:

1. Download the addon ZIP and checksum from GitHub while signed in and transfer
   both to `/root` on the Panel LXC. Verify the checksum there:

   ```sh
   cd /root
   sha256sum -c gmod-toolkit-1.0.0.zip.sha256
   ```

2. On a disposable copy first, extract to a new staging folder readable by the
   Panel's actual file owner (the example uses `www-data`):

   ```sh
   install -d -o www-data -g www-data -m 0700 /var/lib/gmod-toolkit-package-1.0.0
   unzip /root/gmod-toolkit-1.0.0.zip -d /var/lib/gmod-toolkit-package-1.0.0
   chown -R www-data:www-data /var/lib/gmod-toolkit-package-1.0.0
   runuser -u www-data -- php /var/www/pterodactyl/addon-manager/bin/manager.php install \
     --panel-root=/var/www/pterodactyl \
     --package-root=/var/lib/gmod-toolkit-package-1.0.0
   ```

   This queues a normal manager operation. Check its result in the manager before
   proceeding; a successful enqueue does not establish activation. The dedicated
   worker must have the matched frozen frontend dependencies and an isolated
   `panel-v1` runner. For updates, use `update --addon-id=gmod.toolkit` with the
   new unpacked package root. Never edit installed ledger hashes.

3. After activation, open the manager's **GMod Toolkit** admin extension and
   enable the actual GMod eggs. Workshop tools then work through Wings. Configure
   server-side mounting through the separate Startup controls; client Lua writes
   do not change startup variables or require revealing Steam credentials.
4. Provision each FastDL node using [node/README.md](node/README.md). This needs
   its existing HTTPS virtual host/certificate at the node FQDN, plus the two
   supplied proxy locations. The Panel package cannot configure node TLS/listeners
   through Wings' file API. No Addon Manager installation on the node is needed.

Customers use the GMod Toolkit server tab. See [addon/README.md](addon/README.md)
for the exact permissions, backup limits and operational behavior. Revoke public
URLs before disabling/deleting the addon/server if public serving must stop;
the separate node service intentionally retains publications until revoked or
stopped. Suspension does not automatically revoke FastDL snapshots in 1.0.0.

## Develop and verify

Run these from the repository root using PHP 8.2+ with zip and Python 3.11+:

```sh
php addon-manager/sdk/bin/addon.php validate packages/gmod-toolkit/addon
php packages/gmod-toolkit/tests/package.php
python3 -m unittest discover -s packages/gmod-toolkit/tests -p test_node.py -v
```

For real Laravel dependency tests, prepare an absent disposable fixture:

```sh
python3 packages/gmod-toolkit/tools/fixture.py /tmp/gmod-panel-test
cd /tmp/gmod-panel-test
composer install --no-dev --no-scripts --no-plugins --prefer-dist
cd /path/to/this/repository
GMOD_TOOLKIT_DISPOSABLE=1 php packages/gmod-toolkit/tests/panel.php /tmp/gmod-panel-test
```

The Panel suite uses synthetic users/server models and fake Wings/Steam
transports with the actual locked Laravel dependency set. It is not a live node
or game-server test. Package lifecycle tests use explicit fixture build/verifier
adapters; production isolation is tested separately by the installed manager.

`fixture.py --frontend-only` prepares the patched frontend for `yarn tsc`, a
targeted ESLint check, and `yarn build:production`. The stock fixture can use the
root's frozen dependencies. `--variant arix` or `arix-pack` applies the respective
frontend overlays; these additionally need the theme's actual frozen dependency
set, which the root lockfile does not contain. The addon installs no dependencies.

After source review, `python3 packages/gmod-toolkit/tools/manifest.py` calculates
the real declarations and patch hashes. SDK validation/export never refreshes
them silently. Export to an absent output filename:

```sh
php addon-manager/sdk/bin/addon.php export packages/gmod-toolkit/addon \
  --output=packages/gmod-toolkit/dist/gmod-toolkit-1.0.0.zip
(cd packages/gmod-toolkit/dist && sha256sum -c gmod-toolkit-1.0.0.zip.sha256)
```

To publish for URL installation later, upload only the exported addon ZIP and
checksum to an explicitly chosen **public** GitHub release repository. Supply
that public release-asset URL to the manager. Do not publish this private Panel,
licensed Arix sources, live settings, generated node configs or private backups.
