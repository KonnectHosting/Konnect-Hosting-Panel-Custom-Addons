# GMod Toolkit 1.1.0 verification

Contract: Addon Manager 2.0.1 source 5a899b28aa80b08f3ab8a5cbae3e5315cc5c2563;
repository baseline 43927ae7c65e4e8578f9cfd63ffb4d62e60f1ad5. Runtime tests
use PHP 8.3.36, real locked Laravel dependencies, Debian 12/Python 3.11, Node 22
and synthetic hosting data. No production Panel, node, container or Proxmox
configuration was modified.

## Executed checks

- SDK validation, PHP syntax, source/fragment hashes and SDK export round trip.
- 24 Panel/Workshop/FastDL tests: nested/cyclic Workshop collections, safe Lua,
  hostile IDs/links, wrong-game/private items, real Panel owner/subuser policy,
  CSRF, two-factor, server membership/suspension, Lua updates via the actual
  Wings write contract, backup/restore, stale previews and enabled-version guards.
- Panel FastDL tests: automatic egg recognition; asset allowlist; asynchronous
  snapshot preparation; existing Wings API response/transfer size limits and link
  flags; exact previews; real standard-library bzip2 round trip; canonical Panel-hostname
  URLs; independent server tokens; forbidden public paths; rotate/revoke; actor
  binding/expiry; replayed queue steps; snapshot tampering; failed rebuilds
  preserving old publications; in-flight revocation; execution-time permission
  checks; interrupted-step recovery; actual manager guarded-job dispatch; public
  denial on suspension/deletion/disabled eggs; and real anonymous HTTP downloads
  restricted to approved assets while enabled.
- Manager lifecycle fixtures for stock Panel, Arix 2.1.3 and Arix+Pack 2.0.2:
  install, same-ID update, disable, re-enable, delete, retained private data and
  source drift failure. Fixture build/verifier callbacks are test doubles, not
  production isolation attestations.
- Stock native frontend: full TypeScript, targeted ESLint and production webpack
  build. Arix before/after type comparisons introduce zero errors; full Arix
  compilation is not claimed because the root dependency set omits theme
  dependencies (92/100 existing baseline errors). The live host must retain its
  existing matched frozen theme dependencies.
- Full repository archive extraction and package-folder selection through the
  matching SDK, including the standalone publication root. Public GitHub commit
  identity and live archive availability are checked before delivery.
  Publication: a30dfdfd7089db3eaf5c740709fb5cd82686da95.

## Live checks still outside this environment

Test the generated Lua and FastDL downloads in a real GMod client, and exercise
actual Wings responses and the installed theme's frozen build on a disposable
copy of the intended hosting installation. Tests here use fake Wings/Steam
responses and synthetic DB records; they do not establish live Steam or game
behavior. The package uses the Panel's existing queue, scheduler and Python 3;
there is no separate node service or container-side installation to validate.
