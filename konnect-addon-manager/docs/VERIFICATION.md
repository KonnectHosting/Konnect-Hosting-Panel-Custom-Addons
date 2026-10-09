# Development release verification

Verified on 2026-10-09 in disposable installations with PHP 8.3.35, MariaDB
11.4, the Panel's locked Composer dependencies, and an immutable Node 22 image.
The measured source variants were stock Panel 1.15.1 and Panel 1.15.1 with Arix
Theme 2.1.3, Addon Pack 2.0.2, and the 13 controllers delivered by Arix's installer.

| Check | Result |
| --- | --- |
| Standalone acceptance | 151/151 passed; 0 failed, 0 skipped |
| Restricted Docker runner | 16/16 passed; 0 failed, 0 skipped |
| Laravel: stock Panel | 10/10 passed; 0 failed, 0 skipped |
| Laravel: Arix + Addon Pack | 10/10 passed; 0 failed, 0 skipped |
| Browser UI with fixture responses | 27 checks passed |
| Supervised stock lifecycle | Install, disable, enable, update to 1.1.0, delete passed |
| Supervised Arix/Pack lifecycle | Install, disable, enable, update to 1.1.0, delete passed |
| Restricted offline frontend build | Stock: 23 output files; Arix/Pack: 26 output files |

The standalone suite includes unsafe archive/download policies, dependency
composition, source drift, reviewed cascade races, additive migration contracts,
asset stream/SRI validation, and recovery after actual worker process kills.
The Docker suite executes the real validation probe and checks staged boot,
new/changed PHP and compiled Blade, unchanged baseline hashes, read-only mounts,
network isolation, missing handlers/views, and premature probe termination.
The browser suite uses controlled API fixture responses; the Laravel tests use
the actual HTTP kernel, database, session/2FA/CSRF middleware, and registrations.

Both lifecycle runs used real supervised ordinary queue and PHP HTTP processes.
Each action verified durable success, filesystem changes, a fresh guarded route
set, terminal SQL audit state, cleared maintenance, and restarted services.
The Arix fixture also returned HTTP 200 for the manager, existing user admin,
and Arix frontend entry pages. All 21 generated manifest SRI entries and the
main bundle's rendered SHA384 integrity were verified with asset hashing enabled.
The Arix vendor's required frontend packages were prepared before this build;
the manager never installs arbitrary dependency commands from addon packages.

The development Docker daemon is rootful and was used with an explicit trusted
fixture opt-in. Tests confirm that the default policy rejects it. A production
rootless daemon, delegated cgroups, matching immutable runtimes, and the actual
host's supervisor/cron drain policy must be verified on that host. No production
server or Wings/game-server integration was attached to these tests.

Live GitHub downloads could not be verified here because the cloud environment
cannot resolve the direct GitHub API endpoint used by the pinned-IP downloader.
The transport, redirects, addresses, immutable source resolution, checksums, and
link-install protocol were tested with injected transport/DNS fixtures. No TLS,
address checks, or proxy restrictions were weakened to make the live check pass.
Public GitHub DNS/HTTPS access is required on the deployment worker.

The unchanged delivered `ArixPresetController.php` has a PHP 8.2+ property
initializer syntax defect. Twelve other delivered controllers pass PHP syntax
checks. This existing preset feature issue is shown as an informational health
warning. Addon validation checks changed PHP and every retained baseline hash,
then boots the staged Panel; it preserves this vendor file. A corrected vendor
controller needs a reviewed source adapter and baseline maintenance. No Arix
license API requests, vendor code changes, or licensing bypasses were performed.

This is a tested development release for the measured source adapters. Follow
the [administrator guide](ADMINISTRATOR.md) on a disposable copy of the exact
upgraded server before production installation. Existing traditional addons
must be converted to the manifest format; this release does not provide a
generic dynamic React bridge, arbitrary install scripts, destructive migration
rollback, or automatic rebasing after Panel/theme source upgrades.
