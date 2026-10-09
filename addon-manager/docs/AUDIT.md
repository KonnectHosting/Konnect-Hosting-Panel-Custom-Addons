# Addon Manager 2.0.1 bug audit

This audit reviewed all manager runtime, installer, isolated runner, admin UI,
CLI, schemas, SDK, and release tooling. It also checked the actual HTTP kernel,
database and supervised services on the measured stock Panel and Arix fixtures.
It is development evidence, not a guarantee that arbitrary addon code or an
untested production installation has no bugs.

## Confirmed defects corrected

- Package destinations could include nested `.htaccess` or `.user.ini` files,
  and sensitive credential stores were inconsistently filtered. Runtime and
  schema protections now agree; authentication-bearing build configuration is
  excluded from baseline capture and rejected before isolated execution.
- Numeric-key JSON objects could stand in for some primitive arrays. SDK export
  also canonicalized symlink roots before validating them. Both now reject
  these inputs consistently without changing declared payload hashes.
- Explicit GitHub branch/tag archive references lost their namespace during
  commit resolution. Longest-ref resolution also rejected valid folder names
  containing `..` within a segment. Qualified refs and safe folder names now
  resolve correctly; the IPv6 documentation range `3fff::/20` is rejected as
  a download destination.
- Activation could overwrite changes made after its first source check, and
  recovery could delete a replacement temporary file. Final write checks and
  durable inode/hash receipts preserve unexpected bytes and require review.
- Interrupted baseline capture could retain unverified extras. Capture retries
  and reconstruction now verify exact snapshots; regular-file reads, symlink
  checks and directory synchronization fail explicitly when unsafe or unsupported.
- Installer recovery lacked coordinated deployment locking and could lose an
  original hook backup during repair. Installation, recovery and workers now
  coordinate locks, retain full receipts and roll back only their own changes.
  Dry runs and repeat installs check retained state before success or writes;
  only exact planned repairs to the two registration files can be projected.
- Migration receipts could reserve or adopt another addon's table after an
  interrupted create, or report success against schema lost during restoration.
  Durable SQL/filesystem ownership, read-only replay verification and exact
  parsed-byte checksums now reject those cases. Verified legacy pre-DDL
  rejections do not claim tables; unsigned schema drift is also rejected.
- Database snapshot reuse could accept a linked file or inconsistent receipt.
  Snapshot paths, operation identities and checksums now agree before reuse.
- Browser-like two-factor failures could return HTML rather than API JSON.
  Normalization now preserves session/retry headers and hides server diagnostics.
  Mutation actor headers prevent a stale tab replaying under another account.
- UI races could replace current polling state or confirmations, and unexpected
  session/gateway responses could discard an uncertain request ID. Stale reads
  are ignored, failed refreshes block mutations, and durable retries retain their
  identity, including HTTP 400 two-factor failures and validation rejections
  after an ambiguous submission. Attempts are recorded before sending, so tab
  closure cannot erase that uncertainty. Versioned asset URLs fetch the new
  client after an update.
- Enqueue storage failures could be mislabeled as validation rejections after
  an operation was already recorded. Only explicit semantic rejections now
  return HTTP 422; storage and corrupted-receipt failures return a generic
  server error. Repair and retry resolve the original actor-scoped request
  without creating another operation.
- CLI commands accepted irrelevant options before booting Panel. Command-specific
  arguments are now checked first. Supervisor deadlines/output were unbounded;
  configured limits and forced termination now bound failed control commands.
- Docker mount delimiters, staged credentials and probe-global mutation were
  insufficiently guarded. The runner validates mount paths, never pulls a checked
  immutable image implicitly, bounds input and isolates its completion guard.

## Evidence and limits

See [the verification record](VERIFICATION.md) for final test counts, supervised
lifecycle runs and native builds. The version matcher was also compared with
Node's semver implementation across 26,560 standard range/version cases with
zero differences. All three SDK examples passed runtime and schema validation.

Syntax checks covered 1,171 tracked non-manager PHP files, excluding Blade
templates. 1,170 passed. The sole failure was the unchanged Arix vendor preset
controller already documented in the administrator guide. Its affected feature
still requires a corrected vendor delivery and reviewed source adapter. This
audit does not claim every Panel or obfuscated vendor feature was functionally
tested.

Production rootless Docker/cgroup policy, the real host's service/cron drain,
Wings and live public GitHub downloads remain outside this cloud verification.
Network transport policies were tested with injected DNS/HTTP fixtures; live
API access was unavailable here. Database snapshots were exercised, but a
production restore drill remains an operator prerequisite.

Use the [upgrade guide](UPGRADING.md) when replacing 2.0.0. Unexpected retained
credential snapshots and old interrupted temporary receipts fail closed for
review; the manager never repairs its ledger by silently adopting modified code.
