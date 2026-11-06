# Addon Manager: Debian LXC runner

`addon-manager-lxc-runner.zip` is the complete, unsplit runner package, including
the private PHP 8.3.36 / Node 22 runtime, installer, patched runner, sandbox
launcher, seccomp compiler, integrity metadata, and Moby license. No cloud-file
downloads or multipart assembly are required.

This package targets the existing Debian 12 x86_64 Pterodactyl installation at
`/var/www/pterodactyl`, Addon Manager 2.0.1, and its working native systemd worker
control patch. It uses the single-ID user namespaces that were verified inside
the LXC. It requires no changes to the Proxmox host and uses no Docker daemon.

## Download and install

This repository is private. Open `addon-manager-lxc-runner.zip` on GitHub while
signed in, use **Download raw file**, and transfer the ZIP to `/root` on the
Panel LXC. A plain unauthenticated curl request cannot download private files.

Verify its SHA-256:

```text
0391afd5818525f38a9b7d150e0cf5565c9dd7c8f8c6c59d27f92a8b5fe507d3
```

Then run inside the Panel LXC as root:

```sh
cd /root
sha256sum addon-manager-lxc-runner.zip
unzip addon-manager-lxc-runner.zip -d /root
python3 /root/addon-manager-lxc-runner/install-runner.py
```

The installer validates the existing source and package fingerprints, installs
the guest-local Debian `bubblewrap` package if needed, and verifies actual
namespace, seccomp, read-only filesystem, and cgroup resource restrictions before
switching the manager runner. It tests a real Panel boot on a private snapshot
and, when existing frontend dependencies are present, an isolated frontend build.
It restarts the Addon Manager worker and preserves the serving queue/FPM units
and existing native systemd worker control. Backups are kept under
`/var/lib/addon-manager-lxc-patch`.

After success, the installer disables only the failed user Docker unit marked
as created by `setup-panel-addon-host.py`. Previously installed Docker packages
remain installed and are unused by this runner.

Successful completion reports:

```text
Ready: runner=bubblewrap, workerControl=systemd, host.ready=true, manager.ok=true.
```

To restore the previous runner configuration and source:

```sh
python3 /root/addon-manager-lxc-runner/install-runner.py rollback
```

## Existing systemd patch

`addon-manager-systemd-patch.zip` contains the previously delivered native systemd
worker control patch. It is included for completeness. If the systemd installer
already reported `workerControl: driver=systemd, ready=true`, continue with the
runner installer above; the systemd patch is already installed.

`SHA256SUMS` records both archive hashes. Both ZIPs are unchanged from the tested
packages. Runner validation covered a disposable Debian 12 systemd environment,
resource-limit failures, OOM handling, cancellation cleanup, installer application,
idempotence, and rollback using a Panel fixture. Actual Panel compatibility is
checked by the installer on the target LXC before final activation.
