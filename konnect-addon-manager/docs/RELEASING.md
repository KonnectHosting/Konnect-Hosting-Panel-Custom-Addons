# Release packaging

From a clean, reviewed checkout with all manager files present:

```sh
mkdir -p /tmp/konnect-release
php konnect-addon-manager/tools/package-release.php --output=/tmp/konnect-release/konnect-addon-manager.zip
cd /tmp/konnect-release
sha256sum -c konnect-addon-manager.zip.sha256
unzip -l konnect-addon-manager.zip
```

For a repository-local artifact, use a root-level `dist/` directory with
`--output=dist/konnect-addon-manager-1.0.0.zip`. The output must stay outside
`konnect-addon-manager/`, so the archive cannot include itself.

The packaging script includes only `konnect-addon-manager/` with its bootstrap,
installer, CLI, source, adapters, migrations, routes, UI, schema, SDK examples,
guides and tools. It uses an explicit top-level allowlist and excludes tests,
dependency directories, local/private state, dotfiles, caches, logs, temporary
files and previous ZIPs. Symlinked release inputs fail. It never includes the
repository's Panel/Arix/Addon Pack trees or a production `.env`. Keep any other
local data outside those release directories.

ZIP entries are sorted with fixed timestamps, permissions and compression
settings. Repeating the command with unchanged inputs and the same PHP/libzip
toolchain produces identical ZIP bytes; changing compression implementations
can change the digest. The script does not certify compatibility or run the
integration suite. Review the archive and verify tests before publishing it.

Existing outputs are refused. Use a new output directory to compare repeat
builds. A release should include both the ZIP and `.sha256` file, versioned
installation/recovery instructions, its exact tested source adapters and a
plain statement of remaining gaps. Do not claim an arbitrary upgraded server is
supported solely because the repository fixtures passed.

Addon release ZIPs use `sdk/bin/addon.php export`, which also runs core archive
and package validation on the completed archive. The [example GitHub
workflow](../sdk/ci/export-addon.yml) builds optional assets, exports the clean
addon folder and publishes only that ZIP and checksum. It must be adapted to
the addon's repository paths and pinned manager source before use.
