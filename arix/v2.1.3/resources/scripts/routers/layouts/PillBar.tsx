import React from 'react';
import NavigationLinks from './NavigationLinks';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';

export default function PillBar({ children }: { children: React.ReactNode }) {
    const hoverEffect = useStoreState((state: ApplicationStore) => state.settings.data!.arix.layout.hoverEffect);

    return (
        <div className={`bg-gray-700 backdrop boxBorder pb-2 rounded-box w-[250px]`}>
            <NavigationLinks className={hoverEffect.replace(' ', '_')}>{children}</NavigationLinks>
        </div>
    );
}
