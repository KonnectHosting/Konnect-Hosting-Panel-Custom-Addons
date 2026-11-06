# Verification record

Scope: Addon Manager 2.0.1 SDK/runtime contract at `5a899b28aa80b08f3ab8a5cbae3e5315cc5c2563`,
documentation baseline `43927ae7c65e4e8578f9cfd63ffb4d62e60f1ad5`,
Panel 1.15.1 source fixtures, PHP 8.3.36, Node 22 and Debian 12/Python
3.11. No production Panel, Wings node or Proxmox host was changed.

## Executed

- SDK manifest/package validation, payload PHP syntax checks, and exported ZIP
  round-trip extraction validation.
- Eleven node tests: strict asset paths, symlink/hardlink/FIFO exclusion, actual
  HTTP downloads and signed API authentication/replay denial, `.bz2` round-trip,
  raw fallback, independent server tokens, URL rotation/revocation, preview
  expiry/actor/server binding, quotas, changed-source failure preserving the
  previous publication, removed assets, restart recovery and in-flight revocation.
- Ten Panel/Workshop tests using actual locked Laravel dependencies with fake
  Wings/Steam: nested collections/cycles/duplicates, safe ID-only Lua, malicious
  IDs/URLs, unavailable/wrong-game items, real owner/admin/subuser policy, denied
  cross-server/read-only access, egg allowlists, preview/apply/backup/restore,
  stale edits, actor binding, membership/suspension middleware, session CSRF,
  two-factor requirements and enabled-version guards.
  The Wings contract test covers ordinary file writes replacing existing Lua,
  write verification, UTF-8 checks and the actual `symlink` metadata flag;
  Wings' rename API is deliberately not used to overwrite existing files.
- Manager lifecycle fixtures using real package validation/composition/activation
  and explicit fixture build/verifier callbacks: install, same-ID update,
  disable, re-enable, delete, private data retention and drift rejection for
  stock Panel, Arix 2.1.3 and Arix 2.1.3 + Addon Pack 2.0.2 route source variants.
  These callbacks are test doubles, not proof of production build isolation.
- Stock Panel frontend: full TypeScript check, targeted component ESLint, and
  production webpack build. The component introduces no new dependencies.
- Arix and Arix/Pack before/after TypeScript comparison: zero additional errors.
  Existing source/dependency errors remain unchanged (92 and 100 respectively).
  Their full build is not claimed: theme dependencies such as react-icons,
  md5 and dnd-kit are missing from the root lockfile used by this checkout.
- Node service unit checked with Debian 12's systemd unit verifier.

## Required on the actual disposable hosting installation

Exercise node HTTPS/TLS and the configured Wings volume root; verify HMAC
requests from the Panel and downloads from the node FQDN in a real GMod client.
Test the real Wings rename/file-mode behavior, generated Workshop Lua in GMod,
server-side mounting via the actual egg's separate startup variable, and the
installed theme's matched frozen frontend dependencies. Verify one live-shaped
install/update/disable/re-enable on that disposable host before production use.

No public release URL is claimed. The development repository is private; local
package installation is documented and does not weaken the URL importer.
