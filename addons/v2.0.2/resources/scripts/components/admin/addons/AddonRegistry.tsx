import React from 'react';
import { AddonSettings } from '@/api/admin/Addons';
import PluginInstallerDialog from './dialogs/PluginInstallerDialog';
import VersionChangerDialog from './dialogs/VersionChangerDialog';
import IconChangerDialog from './dialogs/IconChangerDialog';
import RatelimitDialog from './dialogs/RatelimitDialog';
import subdomainDialog from './dialogs/SubdomainDialog';
import ModInstallerDialog from './dialogs/ModInstallerDialog';
import WorldInstallerDialog from './dialogs/WorldInstallerDialog';
import ImportEggsDialog from './dialogs/ImportEggsDialog';
import FivemArtifactsDialog from './dialogs/FivemArtifactsDialog';
import FivemUtilsDialog from './dialogs/FivemUtilsDialog';
import StartupChangerDialog from './dialogs/StartupChangerDialog';
import RecordGeneratorDialog from './dialogs/RecordGeneratorDialog';
import ModpackInstallerDialog from './dialogs/ModpackInstallerDialog';
import HytaleModInstallerDialog from './dialogs/HytaleModInstallerDialog';
import AutoSuspendDialog from './dialogs/AutoSuspendDialog';
import EggChangerDialog from './dialogs/EggChangerDialog';
import VariablesDialog from './dialogs/VariablesDialog';
import PropertiesEditorDialog from './dialogs/PropertiesEditorDialog';
import DatabaseImportExportAddonDialog from './dialogs/DatabaseImportExportAddonDialog';

export interface AddonDialogProps {
    open: boolean;
    data: AddonSettings;
    onClose: () => void;
    onSave: (data: AddonSettings) => void;
}

const addonRegistry: Record<string, React.ComponentType<AddonDialogProps>> = {
    minecraftModpackInstaller: ModpackInstallerDialog,
    minecraftPluginInstaller: PluginInstallerDialog,
    minecraftModInstaller: ModInstallerDialog,
    minecraftWorldInstaller: WorldInstallerDialog,
    versionChanger: VersionChangerDialog,
    iconChanger: IconChangerDialog,
    hytaleModsInstaller: HytaleModInstallerDialog,
    subdomainManager: subdomainDialog,
    ratelimit: RatelimitDialog,
    eggImporter: ImportEggsDialog,
    fivemArtifactChanger: FivemArtifactsDialog,
    fivemUtils: FivemUtilsDialog as React.ComponentType<AddonDialogProps>,
    startupChanger: StartupChangerDialog,
    recordGenerator: RecordGeneratorDialog,
    autoSuspend: AutoSuspendDialog,
    eggChanger: EggChangerDialog as React.ComponentType<AddonDialogProps>,
    variableManager: VariablesDialog,
    propertiesEditor: PropertiesEditorDialog,
    databaseImportExport: DatabaseImportExportAddonDialog
};

export default addonRegistry;
