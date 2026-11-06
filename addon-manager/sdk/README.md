# Addon SDK

Start with the [authoring quick start](../docs/ADDON-AUTHORING.md) or give another
coding chat the [copy-and-paste brief](../docs/AI-ADDON-BRIEF.md).

The SDK CLI reuses the manager's `Core\PackageValidator` and `ArchiveExtractor`.
It needs PHP 8.2+ and ext-zip, with no Composer or Laravel dependencies. Keep the
SDK with the matching manager version; its bootstrap and core services are part
of the exporter.

Use a fresh manager distribution when adopting version 2.0.1. Read the
[upgrade guide](../docs/UPGRADING.md) before replacing an existing manager;
active legacy state is refused and is not automatically migrated.

```sh
php addon-manager/sdk/bin/addon.php validate /path/my-addon
php addon-manager/sdk/bin/addon.php export /path/my-addon --output=/tmp/my-addon-1.0.0.zip
```

`validate` exits nonzero on malformed JSON, unsupported declarations, unsafe
paths, hash mismatches or undeclared files. It checks the package contract, not
host compatibility or runtime behavior. `export` performs the same validation
and then round-trip ZIP validation. Existing output files are never overwritten.
Write exports outside the package folder. Remove development dependencies,
build tools and test fixtures from the package; export does not silently drop
undeclared payloads or rewrite a manifest to make it pass.

Use `basic-admin-page/` as a scaffold: copy the folder, change the stable addon ID
and view target, edit compatibility and extension declarations, then recompute
each changed checksum. A manifest is an explicit description of the bytes you
intend to deploy. For example, `sha256sum payload/index.blade.php` prints the hash
for its `files[].sha256` field. Fragment hashes include whitespace and final
newlines.

| Example | Expected behavior |
| --- | --- |
| [basic-admin-page](examples/basic-admin-page/) | Registers an admin page and menu; copies a declared Blade view. |
| [dependency-banner](examples/dependency-banner/) | Depends on the basic addon and replaces one exact page fragment. Disabling it restores the base page. |
| [incompatible-banner](examples/incompatible-banner/) | Valid package with a declared incompatibility against the dependency banner; enabling both must be blocked. |

For a fixture demonstration, install the basic addon, install the dependency
banner, attempt the incompatible banner, then disable/re-enable the dependency
banner. Each example uses manifest version 1, retains addon version 1.0.0,
and declares an exact Panel fixture version and manager `^2.0` compatibility.
The lifecycle still requires matching source, an isolated runner
and health checks. These examples do not establish support on your server.

See [the developer guide](../docs/DEVELOPER.md) for manifest, extension, patch and
migration contracts. Copy [the workflow example](ci/export-addon.yml) into your
addon repository's `.github/workflows/` after replacing its manager source pin.
