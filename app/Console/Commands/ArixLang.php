<?php

namespace Pterodactyl\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

class ArixLang extends Command
{
    protected $signature = 'language:compile';
    protected $description = 'Compile all translations under resources/lang/[lang]/ into a dist directory with flattened filenames';

    public function handle()
    {
        $langPath = resource_path('lang');

        foreach (File::directories($langPath) as $langDir) {
            $lang = basename($langDir);
            $distPath = $langDir . '/dist';

            File::ensureDirectoryExists($distPath);
            File::cleanDirectory($distPath);

            foreach (File::allFiles($langDir) as $file) {
                if (str_contains($file->getPath(), '/dist')) {
                    continue;
                }

                $relativePath = str_replace($langDir . DIRECTORY_SEPARATOR, '', $file->getPathname());
                $relativePath = str_replace('.php', '', $relativePath);
                $flatName = str_replace(DIRECTORY_SEPARATOR, '-', $relativePath) . '.php';

                File::copy($file->getPathname(), $distPath . '/' . $flatName);
            }   

            $this->info("Compiled files for '$lang' into dist/");
        }

        return Command::SUCCESS;
    }
}
