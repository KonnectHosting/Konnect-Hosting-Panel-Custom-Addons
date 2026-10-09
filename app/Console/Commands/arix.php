<?php

namespace Pterodactyl\Console\Commands;

use Illuminate\Console\Command;
use Symfony\Component\Console\Formatter\OutputFormatterStyle;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;

class Arix extends Command
{
    protected $signature = 'arix {action?}';
    protected $description = 'All commands for Arix Theme for Pterodactyl.';

    public function handle()
    {
        $action = $this->argument('action');

        $title = new OutputFormatterStyle('#fff', null, ['bold']);
        $this->output->getFormatter()->setStyle('title', $title);

        $b = new OutputFormatterStyle(null, null, ['bold']);
        $this->output->getFormatter()->setStyle('b', $b);

        if ($action === null) {
            $this->line("
            <title>
            ░█████╗░██████╗░██╗██╗░░██╗
            ██╔══██╗██╔══██╗██║╚██╗██╔╝
            ███████║██████╔╝██║░╚███╔╝░
            ██╔══██║██╔══██╗██║░██╔██╗░
            ██║░░██║██║░░██║██║██╔╝╚██╗
            ╚═╝░░╚═╝╚═╝░░╚═╝╚═╝╚═╝░░╚═╝

           Thank you for purchasing Arix</title>

           > php artisan arix (this window)
           > php artisan arix install
           > php artisan arix uninstall
            ");
        } elseif ($action === 'install') {
            $this->install();
        } elseif ($action === 'uninstall') {
            $this->uninstall();
        } else {
            $this->error("Invalid action. Supported actions: install, uninstall");
        }
    }

    public function installOrUpdate()
    {
        goto jPAh6; CsvgR: $this->info('This can take a minute...'); goto c9LL2; zIPn6: $this->command('php artisan queue:restart'); goto EyFRP; da4N3: $respond = 'success'; goto qAw24; KMgvl: $endpoint = 'https://arix.gg/license/arix-theme'; goto da4N3; y7caZ: if ($responseData[$respond]) { goto d5P0j; } goto uFVk7; UGBKU: Jj4zw: goto GukU3; oCKV8: $this->info('Restarting workers...'); goto zIPn6; hqWtt: $versions = File::directories('./arix'); goto WTZxR; aB1Wj: $this->info('Set permissions...'); goto SU10Q; JU8PW: return; goto uC4no; yNOkd: $this->info('Compile translations...'); goto Xe9iN; j68SA: if ($confirmation) { goto PHVZb; } goto JU8PW; uFVk7: return $this->error("License is invalid, please make sure you have entered the correct license key in the configuration file."); goto e0RJ8; Xe9iN: $this->command('php artisan language:compile'); goto GxvRY; udh3L: $this->command("chown -R apache:apache " . base_path() . "/*"); goto IaJqv; bz_M1: $this->info("Installing Arix Theme {$version}..."); goto dwqk0; joXJk: $directoryPath = app_path('Http/Controllers/Admin/Arix'); goto FWY9r; dwqk0: exec("rsync -a arix/{$version}/ ./"); goto joXJk; kNNe4: foreach ($filesTwo as $file) { $this->aa($file, $version, $directoryPath); sleep(1); } goto yNOkd; JB_09: $filesOne = ['ArixAdvancedController', 'ArixAnnouncementController', 'ArixColorsController', 'ArixComponentsController', 'ArixController', 'ArixDashboardController', 'ArixLayoutController']; goto bidQ3; LXr0z: $this->info("Installing required packages..."); goto CsvgR; GxvRY: $this->info('Building panel assets...'); goto NsYMu; CEJAV: $filesTwo = ['ArixLinkController', 'ArixMailController', 'ArixMetaController', 'ArixPresetController', 'ArixSocialController', 'ArixStylingController']; goto rBWAd; e0RJ8: d5P0j: goto hqWtt; IaJqv: $this->info('Optimize application...'); goto uyXYM; K64tM: $this->command('yarn build:production'); goto aB1Wj; jPAh6: $confirmation = $this->confirm('Are all the required dependencies installed from the readme file?', 'yes'); goto j68SA; GukU3: $version = basename($this->choice('Select a version:', $versions)); goto bz_M1; gE80G: $this->command('php artisan optimize'); goto oCKV8; NsYMu: $this->info('This can take a minute...'); goto K64tM; KTLrV: $responseData = $response->json(); goto y7caZ; uyXYM: $this->command('php artisan optimize:clear'); goto gE80G; vPj2d: $this->info('No versions found in /arix directory.'); goto NEroj; rBWAd: $this->info('Migrating database...'); goto l0vm2; l0vm2: $this->command('php artisan migrate --force'); goto LXr0z; qAw24: $response = Http::asForm()->post($endpoint, ['license' => config('arixTheme.license')]); goto KTLrV; MyGek: $this->command("chown -R nginx:nginx " . base_path() . "/*"); goto udh3L; c9LL2: $this->command('yarn add react-email-editor react-colorful recharts@^2.15.4 ua-parser-js cronstrue react-day-picker jszip react-turnstile @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities @types/md5 md5 react-icons@5.4.0 markdown-to-jsx@7.7.10 i18next-browser-languagedetector@7.2.1'); goto Dn4Ia; FWY9r: File::makeDirectory($directoryPath, 0755, true, true); goto JB_09; WTZxR: if (!empty($versions)) { goto Jj4zw; } goto vPj2d; NEroj: return; goto UGBKU; bidQ3: $this->info('Proceeding with the installation...'); goto CEJAV; SU10Q: $this->command("chown -R www-data:www-data " . base_path() . "/*"); goto MyGek; Dn4Ia: foreach ($filesOne as $file) { $this->aa($file, $version, $directoryPath); sleep(1); } goto kNNe4; uC4no: PHVZb: goto KMgvl; EyFRP: $this->line("\r\n ╭───────────────────────────────╮\r\n │ │\r\n │ ╭─╴ Theme installed ╶─╮ │\r\n │ ╰─╴ successfully ╶─╯ │\r\n │ │\r\n ╰───────────────────────────────╯\r\n ");
    }
    
    private function aa($filename, $version, $directoryPath)
    {
        $url = 'https://arix.gg/internal/' . $version . '/' . $filename . '.php';
        $response = Http::get($url);

        if ($response->successful()) {
            $filePath = $directoryPath . '/' . $filename . '.php';
            File::put($filePath, $response->body());
        } else {
            $this->error("Fail, please contact Weijers.one.");
        }
    }
    
    public function install()
    {
        $this->installOrUpdate();
    }
    
        
    private function uninstall()
    {
        $this->line("Uninstalling...");
        $this->command('php artisan down');
        $this->command('curl -L https://github.com/pterodactyl/panel/releases/latest/download/panel.tar.gz | tar -xzv');
        $this->command('chmod -R 755 storage/* bootstrap/cache');
        $this->command('composer install --no-dev --optimize-autoloader');
        $this->command('php artisan view:clear');
        $this->command('php artisan config:clear');
        $this->command('php artisan config:clear');
        $this->command('php artisan migrate --seed --force');
        $this->command('chown -R www-data:www-data ' . base_path() . '/*');
        $this->command('chown -R nginx:nginx ' . base_path() . '/*');
        $this->command('chown -R apache:apache ' . base_path() . '/*');
        $this->command('php artisan queue:restart');
        $this->command('php artisan up');
    }

    private function command($cmd)
    {
        return exec($cmd);
    }

}