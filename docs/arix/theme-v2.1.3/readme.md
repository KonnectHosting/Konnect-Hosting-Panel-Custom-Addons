### Thank you for choosing the Arix Pterodactyl Theme.

To initiate the installation of the Arix Pterodactyl Theme, ensure that you have installed all the necessary assets:
https://pterodactyl.io/community/customization/panel.html

Create an account at https://arix.gg
Link your BuiltByBit to your Arix account.
Add your license key to your .env file:
```
ARIX_LICENSE_KEY=your_license_key_here```

Simply drag and drop the files into your Pterodactyl folder.

Once the files are uploaded, execute the following 
> php artisan arix

In case the that you're experiencing an error anywhere during the installation process, try the following step: 
> php artisan migrate --force && php artisan optimize:clear && php artisan optimize && chmod -R 755 storage/* bootstrap/cache

For any queries or assistance, feel free to join our Discord community:
https://discord.gg/geCjrRbAwC

If you require more detailed information, please consult our documentation:
https://arix.gg/docs