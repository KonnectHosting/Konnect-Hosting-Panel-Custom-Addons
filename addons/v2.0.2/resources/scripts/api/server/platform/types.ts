export interface ResourceItem {
    id: string;
    icon: string;
    name: string;
    description: string;
    stats: ResourceItemStats;
    project: ResourceItemProject;
}

export interface ResourceItemProject {
    author: string;
    authorUrl: string;
    projectUrl: string;
}

export interface ResourceItemStats {
    downloads: number;
    likes: number;
    lastUpdated: Date;
}

export interface ResourceVersions {
    versions: ResourceVersion[];
}

export interface ResourceVersion {
    name: string;
    url: string;
}

export interface InstalledResourceItem {
    id?: number | null;
    plugin_service: string;
    plugin_version: string;
    plugin_service_id: string;
    server_id: number;
    plugin_name: string;
    file_name: string;
    managed_paths: string[];
    plugin_icon: string;
    created_at: Date;
    updated_at: Date;
}

export type FilterState = Record<string, string>;

export interface FilterContext {
    services: string[];
    versionGroups: Record<string, string[]>;
}

export interface FilterFieldConfig {
    key: string;
    label: string;
    type: 'radio' | 'version-tree';
    options?: string[] | ((filters: FilterState, ctx: FilterContext) => string[]);
    visible?: (filters: FilterState, ctx: FilterContext) => boolean;
    resetsOnChange?: string[];
    toggleable?: boolean;
}

export interface ResourceConfig {
    resource: string;
    installDirectory: string;
    translationNamespace: string;
    titleKey: string;
    filters: FilterFieldConfig[];
}
