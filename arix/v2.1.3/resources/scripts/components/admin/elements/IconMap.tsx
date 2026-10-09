import React, { useEffect, useState } from 'react';
import {
    HiOutlineAdjustments,
    HiOutlineArchive,
    HiOutlineCalendar,
    HiOutlineCog,
    HiOutlineDatabase,
    HiOutlineEye,
    HiOutlineFolderOpen,
    HiOutlineGlobe,
    HiOutlineTerminal,
    HiOutlineUsers,
    HiOutlineViewGrid,
} from 'react-icons/hi';

type IconComponent = React.ComponentType<any>;
type HiModule = Record<string, unknown>;

export const iconMap: Record<string, IconComponent> = {
    HiOutlineViewGrid: HiOutlineViewGrid,
    HiOutlineTerminal: HiOutlineTerminal,
    HiOutlineCog: HiOutlineCog,
    HiOutlineEye: HiOutlineEye,
    HiOutlineFolderOpen: HiOutlineFolderOpen,
    HiOutlineDatabase: HiOutlineDatabase,
    HiOutlineArchive: HiOutlineArchive,
    HiOutlineGlobe: HiOutlineGlobe,
    HiOutlineCalendar: HiOutlineCalendar,
    HiOutlineUsers: HiOutlineUsers,
    HiOutlineAdjustments: HiOutlineAdjustments,
};

const iconCache: Record<string, IconComponent | undefined> = { ...iconMap };

let hiModulePromise: Promise<HiModule> | null = null;
let allIconNamesPromise: Promise<string[]> | null = null;

const loadHiModule = () => {
    if (!hiModulePromise) {
        hiModulePromise = import('react-icons/hi') as Promise<HiModule>;
    }

    return hiModulePromise;
};

const toHiExportName = (name: string) => {
    if (name.startsWith('HiSolid')) {
        return `Hi${name.slice('HiSolid'.length)}`;
    }

    return name;
};

const isIconComponent = (value: unknown): value is IconComponent => typeof value === 'function';

export const loadIconByName = async (name: string): Promise<IconComponent | undefined> => {
    if (iconCache[name]) {
        return iconCache[name];
    }

    const mod = await loadHiModule();
    const exportName = toHiExportName(name);
    const candidate = mod[exportName];

    if (!isIconComponent(candidate)) {
        return undefined;
    }

    iconCache[name] = candidate;
    return candidate;
};

export const getAllIconNames = async (): Promise<string[]> => {
    if (allIconNamesPromise) {
        return allIconNamesPromise;
    }

    allIconNamesPromise = loadHiModule().then((mod) => {
        const names = Object.entries(mod)
            .filter(([key, value]) => isIconComponent(value) && /^Hi[A-Z]/.test(key))
            .map(([key]) => (key.startsWith('HiOutline') ? key : key.replace(/^Hi/, 'HiSolid')));

        return Array.from(new Set(names)).sort();
    });

    return allIconNamesPromise;
};

export const preloadAllIcons = () => {
    void loadHiModule();
    void getAllIconNames();
};

type IconProps = {
    name: string;
    className?: string;
    size?: string | number;
    [key: string]: any;
};

export const Icon = ({ name, className, ...props }: IconProps) => {
    const [component, setComponent] = useState<IconComponent | undefined>(() => iconCache[name]);

    useEffect(() => {
        let isMounted = true;

        if (iconCache[name]) {
            setComponent(() => iconCache[name]);
            return () => {
                isMounted = false;
            };
        }

        void loadIconByName(name).then((loaded) => {
            if (isMounted) {
                setComponent(() => loaded);
            }
        });

        return () => {
            isMounted = false;
        };
    }, [name]);

    if (!component) {
        return <label className={className} {...props} />;
    }

    const Component = component;
    return <Component className={className} {...props} />;
};

export default Icon;
