### Thank you for choosing the Arix Addon Pack for Pterodactyl.

To install the Arix Addon Pack, you must first request a license on [our website](arix.gg). Each purchase includes a single license, which cannot be shared.

Once you receive your license key, add it to your `.env` file, replace `<license_key>` with your key:
```
PLUGINS_ADDON_LICENSE_KEY=<license_key>
```


To edit your `.env` file, use the following command:
```sh
 nano .env
```

Simply drag and drop the files into your Pterodactyl folder.

Once the files are uploaded, execute the following 
```sh
php artisan addons
```

In case the that you're experiencing an error anywhere during the installation process, try the following step: 
```sh
php artisan migrate --force && php artisan optimize:clear && php artisan optimize && chmod -R 755 storage/* bootstrap/cache
```

For any queries or assistance, feel free to join our Discord community:
https://discord.gg/geCjrRbAwC

If you require more detailed information, please consult our documentation:
https://arix.gg/docs