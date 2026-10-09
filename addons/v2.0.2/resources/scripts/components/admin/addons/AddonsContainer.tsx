import React, { useEffect, useState } from 'react';
import EditorWrapper from '../elements/EditorWrapper';
import { Button, styles } from '@/components/elements/button/index';
import Input from '@/components/elements/Input';
import Label from '@/components/elements/Label';
import Badge from '@/components/elements/Badge';
import Spinner from '@/components/elements/Spinner';
import {
    AdjustmentsIcon,
    BanIcon,
    BeakerIcon,
    BriefcaseIcon,
    CloudDownloadIcon,
    CogIcon,
    CollectionIcon,
    DatabaseIcon,
    DocumentAddIcon,
    DocumentDownloadIcon,
    DocumentTextIcon,
    DuplicateIcon,
    ExternalLinkIcon,
    GlobeAltIcon,
    LibraryIcon,
    LightBulbIcon,
    LinkIcon,
    MapIcon,
    PhotographIcon,
    PuzzleIcon,
    ShieldExclamationIcon,
    UsersIcon,
    VariableIcon,
} from '@heroicons/react/outline';
import classNames from 'classnames';
import { AddonSettings, getAddons } from '@/api/admin/Addons';
import addonRegistry from './AddonRegistry';
import useFlash from '@/plugins/useFlash';
import { httpErrorToHuman } from '@/api/http';
import Tooltip from '@/components/elements/tooltip/Tooltip';

interface AddonMeta {
    key?: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    name: string;
    game: string;
    description: string;
    tip?: boolean;
    beta?: boolean;
}

const addonList: AddonMeta[] = [
{
        key: 'minecraftModpackInstaller',
        icon: BeakerIcon,
        name: 'Modpack Installer',
        game: 'Minecraft',
        description: 'Easily install modpacks on servers with a single click.',
        beta: true,
    },
    {
        key: 'minecraftPluginInstaller',
        icon: DocumentAddIcon,
        name: 'Plugin Installer',
        game: 'minecraft',
        description: 'Easily install plugins on servers with a single click.',
    },
    {
        key: 'versionChanger',
        icon: CollectionIcon,
        name: 'Version Changer',
        game: 'minecraft',
        description: 'Easily change the version of servers with a single click.',
    },
    {
        key: 'iconChanger',
        icon: PhotographIcon,
        name: 'Icon Changer',
        game: 'minecraft',
        description: 'Easily change the icons of servers with a single click.',
    },
    {
        key: 'minecraftModInstaller',
        icon: PuzzleIcon,
        name: 'Mod Installer',
        game: 'minecraft',
        description: 'Easily install mods on servers with a single click.',
    },
    {
        tip: true,
        icon: LightBulbIcon,
        name: 'Premium Features',
        game: 'all',
        description: 'Make features/addons only available to premium servers (supports third-party addons too).',
    },
    {
        key: 'minecraftWorldInstaller',
        icon: MapIcon,
        name: 'World Installer',
        game: 'minecraft',
        description: 'Easily install worlds on servers with a single click.',
    },
    {
        key: 'hytaleModsInstaller',
        icon: BeakerIcon,
        name: 'Mod Installer',
        game: 'hytale',
        description: 'Easily install mods on servers with a single click.',
        beta: true,
    },
    {
        key: 'subdomainManager',
        icon: GlobeAltIcon,
        name: 'Subdomain Manager',
        game: 'all',
        description: 'Easily create and manage subdomains for game servers.',
    },
    {
        key: 'ratelimit',
        icon: ShieldExclamationIcon,
        name: 'Ratelimit Editor',
        game: 'all',
        description: 'Easily adjust the ratelimits to prevent abuse.',
    },
    {
        key: 'propertiesEditor',
        icon: DocumentTextIcon,
        name: 'Properties Editor',
        game: 'Minecraft',
        description: 'Easily edit the server.properties file for Minecraft servers.',
    },
    {
        key: 'variableManager',
        icon: VariableIcon,
        name: 'Variables Editor',
        game: 'all',
        description: 'Easily edit the environment variables of servers in the panel.',
    },
    {
        key: 'startupChanger',
        icon: AdjustmentsIcon,
        name: 'Startup Editor',
        game: 'all',
        description: 'Easily edit the startup parameters of servers in the panel.',
    },
    {
        beta: true,
        key: 'eggChanger',
        icon: AdjustmentsIcon,
        name: 'Egg Changer',
        game: 'all',
        description: 'Easily switch the egg of servers with a single click.',
    },
    {
        key: 'eggImporter',
        icon: CloudDownloadIcon,
        name: 'Egg Importer',
        game: 'all',
        description: 'Easily import eggs into the panel with a single click.',
        beta: true,
    },
    {
        key: 'autoSuspend',
        icon: BanIcon,
        name: 'Auto Suspend',
        game: 'all',
        description: 'Automatically suspend servers after expiration date.',
    },
    {
        key: 'fivemUtils',
        icon: BriefcaseIcon,
        name: 'FiveM Utils',
        game: 'fivem',
        description: 'Easily manage FiveM servers with these useful utilities.',
    },
    {
        key: 'fivemArtifactChanger',
        icon: CollectionIcon,
        name: 'Artifacts Changer',
        game: 'fivem',
        description: 'Easily change the FiveM artifact version of servers.',
    },
    {
        key: 'databaseImportExport',
        icon: DatabaseIcon,
        name: 'Database Import/Export',
        game: 'all',
        description: 'Let users import and export their database files.',
    },
    {
        key: 'recordGenerator',
        icon: GlobeAltIcon,
        name: 'Record Generator',
        game: 'all',
        description: 'Let users generate DNS records for their servers.',
    },
    // {
    //     icon: LibraryIcon,
    //     name: 'Prefabs Installer',
    //     game: 'hytale',
    //     description: 'Easily install prefabs for your servers with a single click.',
    // },
    // {
    //     icon: DuplicateIcon,
    //     name: 'Instance Manager',
    //     game: 'all',
    //     description: 'Let users have multiple instances of their server.',
    // },
    // {
    //     icon: UsersIcon,
    //     name: 'Player Manager',
    //     game: 'Minecraft',
    //     description: 'Let users manage players on their servers.',
    // },
    // {
    //     icon: DuplicateIcon,
    //     name: 'Server Presets',
    //     game: 'all',
    //     description: 'Make it easy to create and manage server presets.',
    // },
    // {
    //     icon: DuplicateIcon,
    //     name: 'Server Templates',
    //     game: 'all',
    //     description: 'Let users pick from a list of pre-defined server templates.',
    // },
];

export default () => {
    const [search, setSearch] = useState('');
    const [addonData, setAddonData] = useState<Record<string, AddonSettings>>({});
    const [loading, setLoading] = useState(true);
    const [openDialog, setOpenDialog] = useState<string | null>(null);
    const { addFlash } = useFlash();

    useEffect(() => {
        getAddons()
            .then(setAddonData)
            .catch((err) => addFlash({ type: 'error', message: httpErrorToHuman(err) }))
            .finally(() => setLoading(false));
    }, []);

    const handleSave = (addonKey: string, updated: AddonSettings) => {
        setAddonData((prev) => ({ ...prev, [addonKey]: updated }));
    };

    const filtered = addonList.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <EditorWrapper title='Addons Configuration'>
            <div className='px-6 space-y-4 pb-5'>
                <div>
                    <Label htmlFor='search'>Search for addons</Label>
                    <Input
                        id='search'
                        placeholder='Search for addons...'
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {loading ? (
                    <div className='flex items-center gap-x-2 py-4'>
                        <Spinner size='small' />
                        <span>Loading Addon Pack...</span>
                    </div>
                ) : (
                    filtered.map((addon, i) => {
                        const backendData = addon.key ? addonData[addon.key] : undefined;
                        const isEnabled = backendData?.enabled ?? false;
                        const hasDialog = addon.key ? Boolean(addonRegistry[addon.key]) : false;
                        const DialogComponent = addon.key ? addonRegistry[addon.key] : undefined;

                        return (
                            <React.Fragment key={`${addon.name}-${i}`}>
                                {addon.tip ? (
                                    <div className='bg-yellow-500/10 border border-yellow-500/20 rounded-box'>
                                        <div className='px-4 py-3 border-b border-yellow-500/20'>
                                            <div className='flex items-center justify-between mb-2'>
                                                <div className='flex items-center gap-x-1'>
                                                    {addon.icon && <addon.icon className='w-5 h-5 text-yellow-500' />}
                                                    <h3 className='text-lg font-medium text-gray-100'>{addon.name}</h3>
                                                </div>
                                            </div>
                                            <p className='text-gray-100'>{addon.description}</p>
                                        </div>
                                        <div className='flex justify-end px-4 py-3'>
                                            <a
                                                href={'https://arix.gg/docs/premium-features'}
                                                className={classNames(
                                                    styles.button,
                                                    styles.text,
                                                    styles.secondary,
                                                    styles.small,
                                                    'flex items-center gap-x-1'
                                                )}
                                                target='_blank'
                                            >
                                                Learn more
                                                <ExternalLinkIcon className='w-4 h-4' />
                                            </a>
                                        </div>
                                    </div>
                                ) : (
                                    <div className='bg-gray-600 boxBorder rounded-box'>
                                        <div className='px-4 py-3 border-b border-gray-500'>
                                            <div className='flex items-center justify-between mb-2'>
                                                <div className='flex items-center gap-x-1'>
                                                    {addon.icon && <addon.icon className='w-5 h-5 text-gray-300' />}
                                                    <h3 className='text-lg font-medium text-gray-100'>{addon.name}</h3>
                                                    {addon.beta && (
                                                        <Tooltip content={'Beta Feature'}>
                                                            <div className='p-1 cursor-pointer'>
                                                                <div className='w-3 h-3 bg-blue-500/80 rounded-full' />
                                                            </div>
                                                        </Tooltip>
                                                    )}
                                                </div>
                                                {backendData ? (
                                                    <Badge className='text-sm' color={isEnabled ? 'success' : 'danger'}>
                                                        {isEnabled ? 'Enabled' : 'Disabled'}
                                                    </Badge>
                                                ) : (
                                                    <Badge className='text-sm bg-gray-500'>Roadmap</Badge>
                                                )}
                                            </div>
                                            <p>{addon.description}</p>
                                        </div>
                                        <div className='flex items-center justify-between px-4 py-3'>
                                            <div className='flex items-center gap-x-1'>
                                                <span className='py-1 px-2 rounded bg-gray-500 capitalize text-sm'>
                                                    {addon.game}
                                                </span>
                                            </div>
                                            <Button.Text
                                                size={Button.Sizes.Small}
                                                disabled={!hasDialog}
                                                onClick={() => addon.key && setOpenDialog(addon.key)}
                                            >
                                                <CogIcon className='w-4 h-4 mr-2' />
                                                Settings
                                            </Button.Text>
                                        </div>
                                    </div>
                                )}

                                {DialogComponent && backendData && addon.key && (
                                    <DialogComponent
                                        open={openDialog === addon.key}
                                        data={backendData}
                                        onClose={() => setOpenDialog(null)}
                                        onSave={(updated) => handleSave(addon.key!, updated)}
                                    />
                                )}
                            </React.Fragment>
                        );
                    })
                )}

                <a
                    href='https://arix.gg/community'
                    target='_blank'
                    rel='noreferrer'
                    className='block border border-gray-500 px-4 py-3 border-dashed rounded-box hover:bg-gray-600 duration-300'
                >
                    <h3 className='text-lg font-medium text-gray-100'>Missing Anything?</h3>
                    <p className='mt-1'>If there is an addon you would like to see, please let us know!</p>
                    <div className={classNames(styles.button, styles.text, styles.secondary, 'mt-4 flex items-center gap-1 w-full')}>
                        <LinkIcon className='w-4 h-4' />
                        Join our community
                    </div>
                </a>
            </div>
        </EditorWrapper>
    );
};