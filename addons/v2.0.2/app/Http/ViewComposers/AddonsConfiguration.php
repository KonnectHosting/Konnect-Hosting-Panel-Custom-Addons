<?php

namespace Pterodactyl\Http\ViewComposers;

use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;

class AddonsConfiguration
{
    public function __construct(private SettingsRepositoryInterface $settings)
    {
    }

    /**
     * Defines all addons and their fields with types and defaults.
     * To add a new addon: insert an entry here — controller, request, and config all derive from this.
     */
    public static function definitions(): array
    {
        // nullable: true  → array uses 'present' (can be empty), string/boolean uses 'nullable'
        // nullable: false → array uses 'required' (min 1 item), string/boolean uses 'required'
        return [
            'minecraftPluginInstaller' => [
                'enabled'  => ['type' => 'boolean', 'default' => true,  'nullable' => false],
                'eggs'     => ['type' => 'array',   'default' => [],    'nullable' => true],
                'nests'    => ['type' => 'array',   'default' => [1],   'nullable' => true],
            ],
            'minecraftModpackInstaller' => [
                'enabled'  => ['type' => 'boolean', 'default' => true,  'nullable' => false],
                'eggs'     => ['type' => 'array',   'default' => [],    'nullable' => true],
                'nests'    => ['type' => 'array',   'default' => [1],   'nullable' => true],
            ],
            'minecraftModInstaller' => [
                'enabled'  => ['type' => 'boolean', 'default' => true,  'nullable' => false],
                'eggs'     => ['type' => 'array',   'default' => [],    'nullable' => true],
                'nests'    => ['type' => 'array',   'default' => [1],   'nullable' => true],
            ],
            'minecraftWorldInstaller' => [
                'enabled'  => ['type' => 'boolean', 'default' => true,  'nullable' => false],
                'eggs'     => ['type' => 'array',   'default' => [],    'nullable' => true],
                'nests'    => ['type' => 'array',   'default' => [1],   'nullable' => true],
            ],
            'versionChanger' => [
                'enabled'  => ['type' => 'boolean', 'default' => true,  'nullable' => false],
                'eggs'     => ['type' => 'array',   'default' => [],    'nullable' => true],
                'nests'    => ['type' => 'array',   'default' => [1],   'nullable' => true],
            ],
            'iconChanger' => [
                'enabled'  => ['type' => 'boolean', 'default' => true,  'nullable' => false],
                'eggs'     => ['type' => 'array',   'default' => [],    'nullable' => true],
                'nests'    => ['type' => 'array',   'default' => [1],   'nullable' => true],
            ],
            'hytaleModsInstaller' => [
                'enabled'  => ['type' => 'boolean', 'default' => false,  'nullable' => false],
                'eggs'     => ['type' => 'array',   'default' => [],    'nullable' => true],
                'nests'    => ['type' => 'array',   'default' => [],   'nullable' => true],
            ],
            'subdomainManager' => [
                'enabled'  => ['type' => 'boolean', 'default' => true,  'nullable' => false],
                'eggs'     => ['type' => 'array',   'default' => [],    'nullable' => true],
                'nests'    => ['type' => 'array',   'default' => [],   'nullable' => true],
            ],
            'ratelimit' => [
                'enabled'       => ['type' => 'boolean', 'default' => true,  'nullable' => false],
                'multiplier'    => ['type' => 'number',   'default' => 1,    'nullable' => false],
            ],
            'eggImporter' => [
                'enabled' => ['type' => 'boolean', 'default' => true,  'nullable' => false],
            ],
            'fivemArtifactChanger' => [
                'enabled'  => ['type' => 'boolean', 'default' => false,  'nullable' => false],
                'eggs'     => ['type' => 'array',   'default' => [],    'nullable' => true],
                'nests'    => ['type' => 'array',   'default' => [],   'nullable' => true],
            ],
            'fivemUtils' => [
                'enabled'           => ['type' => 'boolean', 'default' => false,  'nullable' => false],
                'txAdminLogin'      => ['type' => 'boolean', 'default' => true,  'nullable' => false],
                'txAdminSetup'      => ['type' => 'boolean', 'default' => true,  'nullable' => false],
                'cacheDelete'       => ['type' => 'boolean', 'default' => true,  'nullable' => false],
                'eggs'              => ['type' => 'array',   'default' => [],    'nullable' => true],
                'nests'             => ['type' => 'array',   'default' => [],   'nullable' => true],
            ],
            'startupChanger' => [
                'enabled'  => ['type' => 'boolean', 'default' => false,  'nullable' => false],
                'eggs'     => ['type' => 'array',   'default' => [],    'nullable' => true],
                'nests'    => ['type' => 'array',   'default' => [],   'nullable' => true],
            ],
            'recordGenerator' => [
                'enabled'  => ['type' => 'boolean', 'default' => true,  'nullable' => false]
            ],
            'autoSuspend' => [
                'enabled'  => ['type' => 'boolean', 'default' => false,  'nullable' => false],
            ],
            'eggChanger' => [
                'enabled'       => ['type' => 'boolean', 'default' => false,  'nullable' => false],
                'eggs'          => ['type' => 'array',   'default' => [],    'nullable' => true],
                'nests'         => ['type' => 'array',   'default' => [],   'nullable' => true],
                'forceStartup'  => ['type' => 'boolean', 'default' => false,  'nullable' => false],
                'restriction'   => ['type' => 'enum',    'default' => 'none', 'nullable' => false, 'options' => ['none', 'nestBased', 'custom']],
                'eggMap'        => ['type' => 'map',     'default' => [],   'nullable' => true],
            ],
            'variableManager' => [
                'enabled'  => ['type' => 'boolean', 'default' => true,  'nullable' => false],
                'eggs'     => ['type' => 'array',   'default' => [],    'nullable' => true],
                'nests'    => ['type' => 'array',   'default' => [],   'nullable' => true],
            ],
            'propertiesEditor' => [
                'enabled'  => ['type' => 'boolean', 'default' => true,  'nullable' => false],
                'eggs'     => ['type' => 'array',   'default' => [],    'nullable' => true],
                'nests'    => ['type' => 'array',   'default' => [1],   'nullable' => true],
            ],
            'databaseImportExport' => [
                'enabled'  => ['type' => 'boolean', 'default' => false,  'nullable' => false],
                'eggs'     => ['type' => 'array',   'default' => [],    'nullable' => true],
                'nests'    => ['type' => 'array',   'default' => [],   'nullable' => true],
            ],
        ];
    }

    public function getAddon(string $addonKey): array
    {
        $fields = self::definitions()[$addonKey];
        $addon = ['key' => $addonKey];

        foreach ($fields as $fieldKey => $fieldDef) {
            $settingKey = "settings::arix:addons:{$addonKey}:{$fieldKey}";

            $addon[$fieldKey] = match ($fieldDef['type']) {
                'boolean' => filter_var(
                    $this->settings->get($settingKey, $fieldDef['default']),
                    FILTER_VALIDATE_BOOLEAN
                ),
                'array', 'map' => json_decode(
                    $this->settings->get($settingKey, json_encode($fieldDef['default'])),
                    true
                ) ?? $fieldDef['default'],
                'number' => (int) $this->settings->get($settingKey, $fieldDef['default']),
                default => (string) $this->settings->get($settingKey, $fieldDef['default']),
            };
        }

        return $addon;
    }

    public function getConfiguration(): array
    {
        $addons = [];

        foreach (array_keys(self::definitions()) as $addonKey) {
            $addons[$addonKey] = $this->getAddon($addonKey);
        }

        return $addons;
    }
}
