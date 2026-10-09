import React, { lazy } from 'react';
import DashboardContainer from '@/components/server/dashboard/DashboardContainer';
import ServerConsole from '@/components/server/console/ServerConsoleContainer';
import FullConsoleContainer from '@/components/server/console/FullConsoleContainer';
import DatabasesContainer from '@/components/server/databases/DatabasesContainer';
import ScheduleContainer from '@/components/server/schedules/ScheduleContainer';
import UsersContainer from '@/components/server/users/UsersContainer';
import BackupContainer from '@/components/server/backups/BackupContainer';
import NetworkContainer from '@/components/server/network/NetworkContainer';
import StartupContainer from '@/components/server/startup/StartupContainer';
import FileManagerContainer from '@/components/server/files/FileManagerContainer';
import SettingsContainer from '@/components/server/settings/SettingsContainer';
import AccountOverviewContainer from '@/components/dashboard/account/AccountOverviewContainer';
import ActivityLogContainer from '@/components/dashboard/activity/ActivityLogContainer';
import ServerActivityLogContainer from '@/components/server/ServerActivityLogContainer';
import CodeEditorContainer from '@/components/server/files/codeEditor/CodeEditorContainer';
import AccountApiContainer from '@/components/dashboard/account/AccountApiContainer';
import AccountSSHContainer from '@/components/dashboard/ssh/AccountSSHContainer';
import AccountSecurityContainer from '@/components/dashboard/account/AccountSecurityContainer';

import PropertiesContainer from "@/components/server/properties/PropertiesContainer";
import DomainsContainer from "@/components/server/subdomains/SubdomainsContainer";
import PluginsContainer from "@/components/server/plugins/PluginsContainer";
import VersionsContainer from "@/components/server/versions/VersionsContainer";
import ModsContainer from "@/components/server/mods/ModsContainer";
import WorldsContainer from '@/components/server/worlds/WorldsContainer';
import ArtifactsContainer from '@/components/server/fivem/ArtifactsContainer';
import FivemUtilsContainer from '@/components/server/fivem/FivemUtilsContainer';
import ModpacksContainer from '@/components/server/modpacks/ModpacksContainer';
import HytaleModsContainer from '@/components/server/hytaleMods/HytaleModsContainer';
import VariablesContainer from '@/components/server/variables/VariablesContainer';

const FileEditContainer = lazy(() => import('@/components/server/files/FileEditContainer'));
const ScheduleEditContainer = lazy(() => import('@/components/server/schedules/ScheduleEditContainer'));

interface RouteDefinition {
    path: string;
    // If undefined is passed this route is still rendered into the router itself
    // but no navigation link is displayed in the sub-navigation menu.
    name: string | undefined;
    component: React.ComponentType;
    exact?: boolean;
}

interface ServerRouteDefinition extends RouteDefinition {
    permission: string | string[] | null;
    nestId?: number;
    eggId?: number;
    nestIds?: number[];
    eggIds?: number[];
    addon?: string;
}

interface Routes {
    // All of the routes available under "/account"
    account: RouteDefinition[];
    // All of the routes available under "/server/:id"
    server: ServerRouteDefinition[];
}

export default {
    account: [
        {
            path: '/',
            name: 'account',
            component: AccountOverviewContainer,
            exact: true,
        },
        {
            path: '/activity',
            name: 'account-activity',
            component: ActivityLogContainer,
        },
        {
            path: '/api-keys',
            name: 'api-keys',
            component: AccountApiContainer,
        },
        {
            path: '/ssh-keys',
            name: 'ssh-keys',
            component: AccountSSHContainer,
        },
        {
            path: '/security',
            name: 'security',
            component: AccountSecurityContainer,
        },
    ],
    server: [
        {
            path: '/',
            permission: null,
            name: 'dashboard',
            component: DashboardContainer,
            exact: true,
        },
        {
            path: '/console',
            permission: null,
            name: 'console',
            component: ServerConsole,
            exact: true,
        },
        {
            path: '/console/popup',
            permission: null,
            name: undefined,
            component: FullConsoleContainer,
        },
        {
            path: '/settings',
            permission: ['settings.*', 'file.sftp'],
            name: 'settings',
            component: SettingsContainer,
        },
        {
            path: '/activity',
            permission: 'activity.*',
            name: 'activity',
            component: ServerActivityLogContainer,
        },
        {
            path: '/files',
            permission: 'file.*',
            name: 'files',
            component: FileManagerContainer,
        },
        {
            path: '/files/:action(edit|new)',
            permission: 'file.*',
            name: undefined,
            component: FileEditContainer,
        },
        {
            path: '/files/code-editor',
            permission: 'file.*',
            name: undefined,
            component: CodeEditorContainer,
        },
        {
            path: '/databases',
            permission: 'database.*',
            name: 'databases',
            component: DatabasesContainer,
        },
        {
            path: '/backups',
            permission: 'backup.*',
            name: 'backups',
            component: BackupContainer,
        },
        {
            path: '/network',
            permission: 'allocation.*',
            name: 'network',
            component: NetworkContainer,
        },
        {
            path: '/schedules',
            permission: 'schedule.*',
            name: 'schedules',
            component: ScheduleContainer,
        },
        {
            path: '/schedules/:id',
            permission: 'schedule.*',
            name: undefined,
            component: ScheduleEditContainer,
        },
        {
            path: '/users',
            permission: 'user.*',
            name: 'users',
            component: UsersContainer,
        },
        {
            path: '/startup',
            permission: 'startup.*',
            name: 'startup',
            component: StartupContainer,
        },


        {
            path: "/properties",
            permission: "file.update",
            name: "properties",
            addon: "propertiesEditor",
            component: PropertiesContainer,
        },
        {
            path: "/plugins",
            permission: "file.*",
            name: "plugins",
            addon: "minecraftPluginInstaller",
            component: PluginsContainer,
        },
        {
            path: "/modpacks",
            permission: "file.*",
            name: "modpacks",
            addon: "minecraftModpackInstaller",
            component: ModpacksContainer,
        },
        {
            path: "/mods",
            permission: "file.*",
            name: "mods",
            addon: "minecraftModInstaller",
            component: ModsContainer,
        },
        {
            path: "/worlds",
            permission: "file.*",
            name: "worlds",
            addon: "minecraftWorldInstaller",
            component: WorldsContainer,
        },
        {
            path: "/versions",
            permission: "versions.*",
            name: "versions",
            addon: "versionChanger",
            component: VersionsContainer,
        },
        {
            path: "/domains",
            permission: "file.*",
            name: "subdomains",
            addon: "subdomainManager",
            component: DomainsContainer,
        },
        {
            path: "/artifacts",
            permission: "file.*",
            name: "artifacts",
            addon: "fivemArtifactChanger",
            component: ArtifactsContainer,
        },
        {
            path: "/fivem",
            permission: "file.*",
            name: "fivem",
            addon: "fivemUtils",
            component: FivemUtilsContainer,
        },
        {
            path: "/hytale-mods",
            permission: "file.*",
            name: "hytale-mods",
            addon: "hytaleModsInstaller",
            component: HytaleModsContainer,
        },
        {
            path: "/variables",
            permission: "file.*",
            name: "variables",
            addon: "variableManager",
            component: VariablesContainer,
        }
    ],
} as Routes;
