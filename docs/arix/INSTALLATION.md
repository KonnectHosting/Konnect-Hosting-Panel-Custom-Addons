# Arix packages

This repository includes the files from Arix Theme v2.1.3 and Addon Pack v2.0.2.
The ZIPs' `pterodactyl/` wrapper maps to the repository root; it is not an extra
directory in the deployed panel.

| Package | Versioned payload | Configuration | Commands |
| --- | --- | --- | --- |
| Theme v2.1.3 | `arix/v2.1.3/` | `config/arixTheme.php` | `app/Console/Commands/arix.php`, `app/Console/Commands/ArixLang.php` |
| Addon Pack v2.0.2 | `addons/v2.0.2/` | `config/pluginsAddon.php` | `app/Console/Commands/addons.php` |

Original vendor instructions are preserved in [theme-v2.1.3/readme.md](theme-v2.1.3/readme.md)
and [addon-pack-v2.0.2/readme.md](addon-pack-v2.0.2/readme.md), together with their
HTML and text versions. Package source files are unchanged from the uploads.

## Activate on a configured panel server

Uploading these files does not activate the theme or addons. First prepare the
existing Pterodactyl installation and its customization build prerequisites as
described in the vendor instructions. Obtain the required licenses from Arix;
the theme instructions also require linking your BuiltByBit account.

Set `ARIX_LICENSE_KEY` and `PLUGINS_ADDON_LICENSE_KEY` in the server's private
`.env` file. Never commit license keys or the `.env` file to GitHub.

From the panel root, the vendor's documented entry points are:

```sh
php artisan arix
php artisan addons
```

These commands display help. The included command implementations expose
interactive installation through:

```sh
php artisan arix install
# Select v2.1.3 and complete the theme installation first.
php artisan addons install
# Select v2.0.2.
```

The addon installer uses the theme's `language:compile` command, so install the
theme first. The installers verify licenses, copy the selected version's payload
into the panel, migrate the database, install JavaScript dependencies, build
assets, and refresh caches. The theme installer also downloads additional admin
controllers from Arix. Those 13 controllers are also included in
`app/Http/Controllers/Admin/Arix/`; their download provenance and checksums are
recorded in [ADMIN-CONTROLLERS.md](ADMIN-CONTROLLERS.md). The installer may
replace them with fresh downloads. These activation steps have not been run
by this upload.

Refer to the original readmes for troubleshooting and vendor support.
