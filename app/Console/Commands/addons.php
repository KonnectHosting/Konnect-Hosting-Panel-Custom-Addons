<?php

namespace Pterodactyl\Console\Commands;

use Illuminate\Console\Command;
use Symfony\Component\Console\Formatter\OutputFormatterStyle;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;

class Addons extends Command
{
    protected $signature = 'addons {action?}';
    protected $description = 'All commands for Arix Addon Pack for Pterodactyl.';

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

           Thank you for purchasing Addon Pack</title>

           > php artisan addons (this window)
           > php artisan addons install
            ");
        } elseif ($action === 'install') {
            $this->install();
        } else {
            $this->error("Invalid action. Supported actions: install");
        }
    }
    
    public function install()
    {
        $confirmation = $this->confirm('Are all the required dependencies installed from the readme file?', 'yes');
    
        if (!$confirmation) {
            return;
        }

        $licenseKey = config('pluginsAddon.license');

        if(!$licenseKey){
            $this->error('                                                                     ');
            $this->error('  Please set a license key. For any questions please contact us.     ');
            $this->error('  If you\'ve set a license key run:                                   ');
            $this->error('  <title>php artisan optimize:clear && php artisan optimize</title>                 ');
            $this->error('                                                                     ');
            return;
        }

        $endpoint = 'https://api.arix.gg/resource/arix-addons/verify';
    
        $this->info('Verifying license key...');
        $response = Http::asForm()->post($endpoint, [
            'license' => $licenseKey,
        ]);
    
        $responseData = $response->json();

        if (!$responseData['success']) {
            $this->error("The license key is invalid. For any questions please contact us.");
        }
    
        $versions = File::directories('./addons');
    
        if (empty($versions)) {
            $this->info('No versions found in /addons directory.');
            return;
        }
    
        $version = basename($this->choice('Select a version:', $versions));
    
        $this->info("Installing Addon Pack $version...");
        
        exec("rsync -a addons/{$version}/ ./");
    
        $this->info('Proceeding with the installation...');

        $this->info('Migrating database...');
        $this->command('php artisan migrate --force');
    
        $this->info("Installing required packages...");
        $this->info('This can take a minute...');

        $this->command('yarn add numify');
        
        $this->info('Compiling languages...');
        $this->command('php artisan language:compile');

        $this->info('Building panel assets...');
        $this->info('This can take a minute...');
    
        $nodeVersion = shell_exec('node -v');
        $nodeVersion = (int) ltrim($nodeVersion, 'v');
     
        if ($nodeVersion >= 17) {
            $this->info('Node.js version is v' . $nodeVersion . ' (>= 17)');
            $exportCommand = $this->confirm('Did you run: "export NODE_OPTIONS=--openssl-legacy-provider"?', 'yes');
        
            if (!$exportCommand) {
                $this->error('Please run this command: export NODE_OPTIONS=--openssl-legacy-provider');
            }
        } else {
            $this->info('Node.js version is v' . $nodeVersion . ' (< 17)');
        }
    
        $this->command('yarn build:production');
    
        $this->info('Set permissions...');
        $this->command("chown -R www-data:www-data " . base_path() . "/*");
        $this->command("chown -R nginx:nginx " . base_path() . "/*");
        $this->command("chown -R apache:apache " . base_path() . "/*");
    
        $this->info('Optimize application...');
        $this->command('php artisan optimize:clear');
        $this->command('php artisan optimize');
    
        $this->line("
            ╭────────────────────────────────╮
            │                                │
            │   ╭─╴  Addons Installed  ╶─╮   │
            │   ╰─╴    successfully    ╶─╯   │
            │                                │
            ╰────────────────────────────────╯
        ");
    }

    private function command($cmd)
    {
        return exec($cmd);
    }

    // aa0798e41bd9f700acff3f6c7a73d0ec
}