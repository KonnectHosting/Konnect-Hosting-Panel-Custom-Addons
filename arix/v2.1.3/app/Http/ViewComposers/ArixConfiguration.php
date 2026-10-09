<?php

namespace Pterodactyl\Http\ViewComposers;

use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;

class ArixConfiguration
{
    public function __construct(private SettingsRepositoryInterface $settings)
    {
    }

    private function rgbFromHex(string $hex): string
    {
        $hex = ltrim($hex, '#');
        if (strlen($hex) === 3) {
            $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
        }
        $r = hexdec(substr($hex, 0, 2));
        $g = hexdec(substr($hex, 2, 2));
        $b = hexdec(substr($hex, 4, 2));

        return "$r $g $b";
    }

    private function defaultLinks(): array
    {
        return [
            'general' => [
                'name' => 'general',
                'permission' => [],
                'nests' => [],
                'eggs' => [],
                'active' => true,
                'links' => [
                    [
                        'icon' => 'HiOutlineViewGrid',
                        'name' => 'dashboard',
                        'url' => '/',
                        'permission' => [],
                        'nests' => [],
                        'eggs' => [],
                        'active' => true,
                    ],
                    [
                        'icon' => 'HiOutlineTerminal',
                        'name' => 'console',
                        'url' => '/console',
                        'permission' => [],
                        'nests' => [],
                        'eggs' => [],
                        'active' => true,
                    ],
                    [
                        'icon' => 'HiOutlineCog',
                        'name' => 'settings',
                        'url' => '/settings',
                        'permission' => ['settings.*', 'file.sftp'],
                        'nests' => [],
                        'eggs' => [],
                        'active' => true,
                    ],
                    [
                        'icon' => 'HiOutlineEye',
                        'name' => 'activity',
                        'url' => '/activity',
                        'permission' => ['activity.*'],
                        'nests' => [],
                        'eggs' => [],
                        'active' => true,
                    ],
                ],
            ],
            'management' => [
                'name' => 'management',
                'permission' => [],
                'nests' => [],
                'eggs' => [],
                'active' => true,
                'links' => [
                    [
                        'icon' => 'HiOutlineFolderOpen',
                        'name' => 'files',
                        'url' => '/files',
                        'permission' => ['file.*'],
                        'nests' => [],
                        'eggs' => [],
                        'active' => true,
                    ],
                    [
                        'icon' => 'HiOutlineDatabase',
                        'name' => 'databases',
                        'url' => '/databases',
                        'permission' => ['database.*'],
                        'nests' => [],
                        'eggs' => [],
                        'active' => true,
                    ],
                    [
                        'icon' => 'HiOutlineArchive',
                        'name' => 'backups',
                        'url' => '/backups',
                        'permission' => ['backup.*'],
                        'nests' => [],
                        'eggs' => [],
                        'active' => true,
                    ],
                    [
                        'icon' => 'HiOutlineGlobe',
                        'name' => 'network',
                        'url' => '/network',
                        'permission' => ['network.*'],
                        'nests' => [],
                        'eggs' => [],
                        'active' => true,
                    ],
                ],
            ],
            'configuration' => [
                'name' => 'configuration',
                'permission' => [],
                'nests' => [],
                'eggs' => [],
                'active' => true,
                'links' => [
                    [
                        'icon' => 'HiOutlineCalendar',
                        'name' => 'schedules',
                        'url' => '/schedules',
                        'permission' => ['schedule.*'],
                        'nests' => [],
                        'eggs' => [],
                        'active' => true,
                    ],
                    [
                        'icon' => 'HiOutlineUsers',
                        'name' => 'users',
                        'url' => '/users',
                        'permission' => ['user.*'],
                        'nests' => [],
                        'eggs' => [],
                        'active' => true,
                    ],
                    [
                        'icon' => 'HiOutlineAdjustments',
                        'name' => 'startup',
                        'url' => '/startup',
                        'permission' => ['startup.*'],
                        'nests' => [],
                        'eggs' => [],
                        'active' => true,
                    ],
                ],
            ],
        ];
    }

    public function getConfiguration(): array
    {
        $links = json_decode(
            $this->settings->get('settings::arix:links', json_encode($this->defaultLinks())),
            true,
        ) ?? $this->defaultLinks();

        return [
            'general' => [
                'logo' => (string) $this->settings->get('settings::arix:general:logo', '/arix/Arix.png'),
                'logoLight' => (string) $this->settings->get('settings::arix:general:logoLight', '/arix/Arix.png'),
                'fullLogo' => filter_var($this->settings->get('settings::arix:general:fullLogo', false), FILTER_VALIDATE_BOOLEAN),
                'logoHeight' => (int) $this->settings->get('settings::arix:general:logoHeight', 32),
                'discord' => (string) $this->settings->get('settings::arix:general:discord', '715281172422197300'),
                'support' => (string) $this->settings->get('settings::arix:general:support', 'https://discord.gg/geCjrRbAwC'),
            ],
            'announcement' => [
                'enabled' => filter_var($this->settings->get('settings::arix:announcement:enabled', false), FILTER_VALIDATE_BOOLEAN),
                'position' => (string) $this->settings->get('settings::arix:announcement:position', 'top'),
                'color' => (string) $this->settings->get('settings::arix:announcement:color', '#16aaaa'),
                'icon' => (string) $this->settings->get('settings::arix:announcement:icon', 'megaphone'),
                'message' => (string) $this->settings->get('settings::arix:announcement:message', 'We have a brand new game panel design!'),
                'cta' => filter_var($this->settings->get('settings::arix:announcement:cta', false), FILTER_VALIDATE_BOOLEAN),
                'ctaTitle' => (string) $this->settings->get('settings::arix:announcement:ctaTitle', 'Buy now!'),
                'ctaLink' => (string) $this->settings->get('settings::arix:announcement:ctaLink', '/'),
                'dismissable' => filter_var($this->settings->get('settings::arix:announcement:dismissable', false), FILTER_VALIDATE_BOOLEAN),
            ],
            'styling' => [
                'pageTitle' => filter_var($this->settings->get('settings::arix:styling:pageTitle', true), FILTER_VALIDATE_BOOLEAN),
                'background' => filter_var($this->settings->get('settings::arix:styling:background', false), FILTER_VALIDATE_BOOLEAN),
                'backgroundImage' => (string) $this->settings->get('settings::arix:styling:backgroundImage', ''),
                'backgroundImageLight' => (string) $this->settings->get('settings::arix:styling:backgroundImageLight', ''),
                'loginBackground' => (string) $this->settings->get('settings::arix:styling:loginBackground', '/arix/background-login.png'),
                'backgroundFaded' => (string) $this->settings->get('settings::arix:styling:backgroundFaded', 'default'),
                'backdrop' => filter_var($this->settings->get('settings::arix:styling:backdrop', false), FILTER_VALIDATE_BOOLEAN),
                'backdropPercentage' => (int) $this->settings->get('settings::arix:styling:backdropPercentage', 100),
                'radiusInput' => (int) $this->settings->get('settings::arix:styling:radiusInput', 7),
                'radiusBox' => (int) $this->settings->get('settings::arix:styling:radiusBox', 10),
                'borderInput' => filter_var($this->settings->get('settings::arix:styling:borderInput', true), FILTER_VALIDATE_BOOLEAN),
                'borderBox' => filter_var($this->settings->get('settings::arix:styling:borderBox', true), FILTER_VALIDATE_BOOLEAN),
                'clickEffect' => (string) $this->settings->get('settings::arix:styling:clickEffect', 'drop'),
                'pageTransition' => (string) $this->settings->get('settings::arix:styling:pageTransition', 'fadeUp'),
                'flashMessage' => (int) $this->settings->get('settings::arix:styling:flashMessage', 0),
                'font' => (string) $this->settings->get('settings::arix:styling:font', 'default'),
            ],
            'layout' => [
                'layout' => (string) $this->settings->get('settings::arix:layout:layout', 'default'),
                'dock' => (string) $this->settings->get('settings::arix:layout:dock', 'sidebar'),
                'hoverEffect' => (string) $this->settings->get('settings::arix:layout:hoverEffect', 'default'),
                'searchComponent' => (string) $this->settings->get('settings::arix:layout:searchComponent', "Command Palette"),
                'logoPosition' => (string) $this->settings->get('settings::arix:layout:logoPosition', "top"),
                'socialPosition' => (string) $this->settings->get('settings::arix:layout:socialPosition', "top"),
                'loginLayout' => (string) $this->settings->get('settings::arix:layout:loginLayout', "default"),
            ],
            'components' => [
                'serverRow' => (string) $this->settings->get('settings::arix:components:serverRow', 'default'),
                'statsCards' => (int) $this->settings->get('settings::arix:components:statsCards', 2),
                'sideGraphs' => (int) $this->settings->get('settings::arix:components:sideGraphs', 1),
                'graphs' => (int) $this->settings->get('settings::arix:components:graphs', 1),
                'titledBoxStyle' => (string) $this->settings->get('settings::arix:components:titledBoxStyle', 'default'),
                'statsStyle' => (string) $this->settings->get('settings::arix:components:statsStyle', 'default'),
                'tableStyle' => (string) $this->settings->get('settings::arix:components:tableStyle', 'default'),
            ],
            'dashboardWidgets' => json_decode($this->settings->get('settings::arix:dashboardWidgets', '[]'), true),
            'colors' => [
                'dark' => [
                    'primary' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:dark:primary', '#4d35eb')),
                    'successText' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:dark:successText', '#E1FFD8')),
                    'successBorder' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:dark:successBorder', '#2bab32')),
                    'successBackground' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:dark:successBackground', '#1f8f2b')),
                    'dangerText' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:dark:dangerText', '#FFD8D8')),
                    'dangerBorder' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:dark:dangerBorder', '#ab2b40')),
                    'dangerBackground' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:dark:dangerBackground', '#8f1f37')),
                    'secondaryText' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:dark:secondaryText', '#B2B2C1')),
                    'secondaryBorder' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:dark:secondaryBorder', '#3c3c5d')),
                    'secondaryBackground' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:dark:secondaryBackground', '#2b2b48')),
                    'gray50' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:dark:gray50', '#F4F4F4')),
                    'gray100' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:dark:gray100', '#D5D5DB')),
                    'gray200' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:dark:gray200', '#B2B2C1')),
                    'gray300' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:dark:gray300', '#8282A4')),
                    'gray400' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:dark:gray400', '#5E5E7F')),
                    'gray500' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:dark:gray500', '#3c3c5d')),
                    'gray600' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:dark:gray600', '#2b2b48')),
                    'gray700' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:dark:gray700', '#1a1a2f')),
                    'gray800' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:dark:gray800', '#0c0d21')),
                    'gray900' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:dark:gray900', '#040519')),
                ],
                'light' => [
                    'primary' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:light:primary', '#4d35eb')),
                    'successText' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:light:successText', '#E1FFD8')),
                    'successBorder' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:light:successBorder', '#2bab32')),
                    'successBackground' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:light:successBackground', '#1f8f2b')),
                    'dangerText' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:light:dangerText', '#FFD8D8')),
                    'dangerBorder' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:light:dangerBorder', '#ab2b40')),
                    'dangerBackground' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:light:dangerBackground', '#8f1f37')),
                    'secondaryText' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:light:secondaryText', '#46464D')),
                    'secondaryBorder' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:light:secondaryBorder', '#C0C0D3')),
                    'secondaryBackground' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:light:secondaryBackground', '#A6A7BD')),
                    'gray50' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:light:gray50', '#141415')),
                    'gray100' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:light:gray100', '#27272C')),
                    'gray200' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:light:gray200', '#46464D')),
                    'gray300' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:light:gray300', '#626272')),
                    'gray400' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:light:gray400', '#757689')),
                    'gray500' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:light:gray500', '#A6A7BD')),
                    'gray600' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:light:gray600', '#C0C0D3')),
                    'gray700' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:light:gray700', '#E7E7EF')),
                    'gray800' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:light:gray800', '#F0F1F5')),
                    'gray900' => $this->rgbFromHex((string) $this->settings->get('settings::arix:colors:light:gray900', '#FFFFFF')),
                ],
            ],
            'meta' => [
                'index' => filter_var($this->settings->get('settings::arix:meta:index', true), FILTER_VALIDATE_BOOLEAN),
                'color' => (string) $this->settings->get('settings::arix:meta:color', '#4d35eb'),
                'title' => (string) $this->settings->get('settings::arix:meta:title', 'Pterodactyl Panel'),
                'description' => (string) $this->settings->get('settings::arix:meta:description', 'Our official Pterodactyl panel'),
                'image' => (string) $this->settings->get('settings::arix:meta:image', '/arix/meta-tags.png'),
                'favicon' => (string) $this->settings->get('settings::arix:meta:favicon', '/arix/Arix.png'),
            ],
            'social' => [
                'socials' => json_decode($this->settings->get('settings::arix:social:socials', '[]'), true),
                'socialButtons' => filter_var($this->settings->get('settings::arix:social:socialButtons', false), FILTER_VALIDATE_BOOLEAN),
                'discordBox' => filter_var($this->settings->get('settings::arix:social:discordBox', true), FILTER_VALIDATE_BOOLEAN),
            ],
            'mail' => [
                'editor' => (string) $this->settings->get('settings::arix:mail:editor', 'simple'),

                'logo' => (string) $this->settings->get('settings::arix:mail:logo', 'https://arix.gg/arix.png'),
                'logoFull' => filter_var($this->settings->get('settings::arix:mail:logoFull', false), FILTER_VALIDATE_BOOLEAN),

                'editorCode' => (string) $this->settings->get('settings::arix:mail:editorCode', ''),
                'editorJson' => (string) $this->settings->get('settings::arix:mail:editorJson', ''),

                'developerCode' => (string) $this->settings->get('settings::arix:mail:developerCode', ''),

                'template' => (string) $this->settings->get('settings::arix:mail:template', 'default'),
                'color' => (string) $this->settings->get('settings::arix:mail:color', '#4d35eb'),

                'status' => $this->settings->get('settings::arix:mail:status', 'https://arix.gg/status'),
                'billing' => $this->settings->get('settings::arix:mail:billing', 'https://arix.gg/billing'),
                'support' => $this->settings->get('settings::arix:mail:support', 'https://arix.gg/support'),
            ],

            'advanced' => [
                'profileType' => (string) $this->settings->get('settings::arix:advanced:profileType', 'gravatar'),
                'modeToggler' => filter_var($this->settings->get('settings::arix:advanced:modeToggler', true), FILTER_VALIDATE_BOOLEAN),
                'langSwitch' => filter_var($this->settings->get('settings::arix:advanced:langSwitch', true), FILTER_VALIDATE_BOOLEAN),
                'defaultLang' => (string) $this->settings->get('settings::arix:advanced:defaultLang', 'en'),
                'languageOptions' => json_decode($this->settings->get('settings::arix:advanced:languageOptions', '[{"key":"en","name":"English"}]'), true) ?? [['key' => 'en', 'name' => 'English']],
                'ipFlag' => filter_var($this->settings->get('settings::arix:advanced:ipFlag', true), FILTER_VALIDATE_BOOLEAN),
                'lowResourcesAlert' => filter_var($this->settings->get('settings::arix:advanced:lowResourcesAlert', false), FILTER_VALIDATE_BOOLEAN),
                'alertLink' => (string) $this->settings->get('settings::arix:advanced:alertLink', ''),
                'dashboardPage' => filter_var($this->settings->get('settings::arix:advanced:dashboardPage', true), FILTER_VALIDATE_BOOLEAN),
                'registration' => filter_var($this->settings->get('settings::arix:advanced:registration', false), FILTER_VALIDATE_BOOLEAN),
                'defaultMode' => (string) $this->settings->get('settings::arix:advanced:defaultMode', 'darkmode'),
                'copyright' => (string) $this->settings->get('settings::arix:advanced:copyright', 'Designed by Weijers.one'),

                'trashbin' => filter_var($this->settings->get('settings::arix:advanced:trashbin', true), FILTER_VALIDATE_BOOLEAN),
                'gracePeriod' => (int) $this->settings->get('settings::arix:advanced:gracePeriod', 7),

                'adminTheme' => filter_var($this->settings->get('settings::arix:advanced:adminTheme', true), FILTER_VALIDATE_BOOLEAN),

                'tierVisibility' => (string) $this->settings->get('settings::arix:advanced:tierVisibility', 'hidden'),

                'profileCustomization' => [
                    'username' => filter_var($this->settings->get('settings::arix:advanced:profileCustomization:username', true), FILTER_VALIDATE_BOOLEAN),
                    'name' => filter_var($this->settings->get('settings::arix:advanced:profileCustomization:name', true), FILTER_VALIDATE_BOOLEAN),
                    'email' => filter_var($this->settings->get('settings::arix:advanced:profileCustomization:email', true), FILTER_VALIDATE_BOOLEAN),
                ],
                
                'subscriptionAlert' => filter_var($this->settings->get('settings::arix:advanced:subscription:alert', false), FILTER_VALIDATE_BOOLEAN),
            ],

            'links' => $links,


            // KEYS EXCLUDED: 
            // - advanced:subscription
            // - subscription.target
            // - subscription.endpoint
            // - subscription.identifier
            // - subscription.secret
        ];
    }
}