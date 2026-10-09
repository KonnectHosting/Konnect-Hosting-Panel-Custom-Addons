export interface Addon {
    key: string;
    enabled: boolean;
    eggs: number[];
    nests: number[];
}

export interface AddonsStore {
    minecraftModpackInstaller: Addon;
    minecraftPluginInstaller: Addon;
    minecraftModInstaller: Addon;
    minecraftWorldManager: Addon;
    versionChanger: Addon;
    iconChanger: Addon;
    hytaleModsInstaller: Addon;
    subdomainManager: Addon;
    fivemArtifactChanger: Addon;
    fivemUtils: Addon & {
        txAdminLogin: boolean;
        txAdminSetup: boolean;
        cacheDelete: boolean;
    };
    startupChanger: Addon;
    eggChanger: Addon & {
        forceStartup: boolean;
        restriction: 'none' | 'nestBased' | 'custom';
        eggMap: Record<number, number[]>;
    };
    recordGenerator: {
        key: string;
        enabled: boolean;
    },
    autoSuspend: {
        key: string;
        enabled: boolean;
    },
    variableManager: Addon;
    propertiesEditor: Addon;
}