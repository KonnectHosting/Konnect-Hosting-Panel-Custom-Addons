# Authenticator issuer

Set the panel server's private .env to:

```dotenv
APP_2FA_ISSUER="Konnect Hosting Panel"
```

Keep APP_NAME and the existing APP_KEY unchanged. Never commit .env.
Null, unset, or blank issuer settings fall back to the runtime app.name, including
any panel name loaded from database settings. The dedicated issuer is not a
database-overridden setting. Only config/pterodactyl.php reads the environment,
so Laravel configuration caching is supported.

The issuer and email are each RFC 3986 encoded once. Spaces are preserved,
and the label prefix and issuer query parameter represent the same name.
The fallback also now preserves spaces and fixes the old double encoding.

## Existing and new enrollments

The setting changes enrollment metadata, not the TOTP algorithm, stored secrets,
verification, recovery tokens, or enabled state. Deployment runs no enrollment
service and requires no migration. Existing authenticator entries continue to
generate valid codes and may keep their old displayed name. Users can rename
entries locally if their authenticator supports it. Do not disable/re-enable MFA
or request a new enrollment QR merely to rename an existing entry: enrollment
generates a new secret. Never reset customer MFA in bulk.

New enrollments use Konnect Hosting Panel after configuration is refreshed.
The account email and response keys image_url_data/secret remain unchanged.

## Arix source compatibility review

Reviewed repository snapshot 5a899b28aa80b08f3ab8a5cbae3e5315cc5c2563:
Arix Theme v2.1.3 and Addon Pack v2.0.2 payloads do not contain
app/Services/Users/TwoFactorSetupService.php or config/pterodactyl.php.
The root and versioned Arix getTwoFactorTokenData.ts, ConfigureTwoFactorForm.tsx,
and SetupTOTPDialog.tsx are identical. SetupTOTPDialog passes image_url_data
directly to qrcode.react; no issuer parsing or rewriting occurs.
The API controller still rejects enrollment for accounts with MFA enabled.
SettingsServiceProvider does not override the new issuer key.
No Arix source, assets, APP_NAME, or authentication verification logic changes.
This establishes source compatibility with these bundled versions only;
the deployed panel and any downloaded installer updates remain unverified.

## Validation and deployment gate

PHP and Composer are unavailable in the editing environment; PHPUnit and PHP
lint were not run there. The focused workflow tests PHP 8.2 and 8.3 unit behavior.
On a matching staging installation, also run:

```sh
vendor/bin/phpunit --bootstrap vendor/autoload.php tests/Unit/Services/Users/TwoFactorSetupServiceTest.php
vendor/bin/phpunit tests/Integration/Api/Client/TwoFactorControllerTest.php
```

Before production, compare the deployed versions and affected files with this
snapshot, review the small patch against local changes, and back up the affected
files and configuration. Do not replace the panel with this source snapshot.
Apply only the reviewed service/config changes, set the environment variable,
and refresh configuration using the installation's existing cache procedure
(e.g. php artisan config:cache when config caching is used). No asset rebuild,
theme reinstall, migration, key rotation, or customer MFA reset is needed.

On staging, use a disposable account to scan a new QR, confirm its issuer and
email, complete enrollment, and log in using a generated code. Verify an
already-enrolled test account still logs in without re-enrollment; test recovery
as appropriate. Do not log or publish QR URIs or secrets.
Production deployment is not recommended until these checks pass.

Rollback: restore the previous service/config files and prior APP_2FA_ISSUER
value, then refresh configuration the same way. Leave database secrets, APP_KEY,
and customer authenticator entries intact; newly enrolled codes remain valid.
