import React from 'react';
import { ServerContext } from '@/state/server';
import { ApplicationStore } from '@/state';
import { useStoreState } from 'easy-peasy';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import ServerDetailsBlock from '@/components/server/console/ServerDetailsBlock';
import StatGraphs from '@/components/server/console/StatGraphs';
import SideGraphs from '@/components/server/console/SideGraphs';
import { ViewGridIcon, ArrowRightIcon } from '@heroicons/react/outline';
import Sftp from '@/components/server/dashboard/SFTP';
import Banner from '@/components/server/dashboard/Banner';
import InfoCardAdvanced from '@/components/server/dashboard/InfoCardAdvanced';
import InfoCard from '@/components/server/dashboard/InfoCard';
import { Alert } from '@/components/elements/alert';
import Spinner from '@/components/elements/Spinner';
import Console from '@/components/server/console/Console';
import { useTranslation } from 'react-i18next';
import SubscriptionInfo from './SubscriptionInfo';

interface Props {
    type: string;
}

const Component = ({ type }: Props) => {
    return type == 'banner' ? (
        <Banner />
    ) : type == 'statCards' ? (
        <div className={'lg:col-span-2'}>
            <ServerDetailsBlock />
        </div>
    ) : type == 'graphs' ? (
        <div className={'lg:col-span-2 grid lg:grid-cols-3 gap-4'}>
            <StatGraphs />
        </div>
    ) : type == 'sideGraphs' ? (
        <div className={'col-span-1 row-span-2'}>
            <div className={'w-full flex flex-col gap-4'}>
                <SideGraphs />
            </div>
        </div>
    ) : type == 'SFTP' ? (
        <Sftp />
    ) : type == 'info' ? (
        <InfoCard />
    ) : type == 'infoAdvanced' ? (
        <InfoCardAdvanced />
    ) : type == 'subscription' ? (
        <SubscriptionInfo />
    ) : null;
};

const DashboardContainer = () => {
    const { t } = useTranslation(['arix/server/dashboard', 'arix/server/console']);
    const dashboardWidgets = useStoreState((state: ApplicationStore) => state.settings.data!.arix.dashboardWidgets);

    const isInstalling = ServerContext.useStoreState((state) => state.server.isInstalling);
    const isTransferring = ServerContext.useStoreState((state) => state.server.data!.isTransferring);
    const isNodeUnderMaintenance = ServerContext.useStoreState((state) => state.server.data!.isNodeUnderMaintenance);

    return (
        <ServerContentBlock title={t('dashboard')} icon={ViewGridIcon}>
            {isNodeUnderMaintenance || isInstalling || isTransferring ? (
                <div>
                    <Alert type={'warning'} className={'mb-4'}>
                        {isNodeUnderMaintenance
                            ? t('node-under-maintenance', { ns: 'arix/server/console' })
                            : isInstalling
                            ? t('running-installation-process', { ns: 'arix/server/console' })
                            : t('being-transferred', { ns: 'arix/server/console' })}
                    </Alert>
                    <Spinner.Suspense>
                        <Console />
                    </Spinner.Suspense>
                </div>
            ) : (
                <div className={'grid lg:grid-cols-2 grid-cols-1 gap-4'}>
                    {dashboardWidgets.length === 0 ? (
                        <a
                            className={
                                'lg:col-span-2 px-8 py-6 bg-gradient-to-br from-arix to-purple-600 rounded-box group'
                            }
                            href={'/admin/arix/dashboard'}
                        >
                            <p className={'text-3xl font-medium text-white'}>
                                Customize dashboard page with drag and drop!
                            </p>
                            <p
                                className={
                                    'mt-3 flex items-center gap-x-1 text-white opacity-80 group-hover:opacity-100 group-hover:gap-x-2 duration-300'
                                }
                            >
                                Open Dashboard Editor
                                <ArrowRightIcon className={'w-5 h-5'} />
                            </p>
                        </a>
                    ) : (
                        dashboardWidgets.map((widget, index) => <Component key={index} type={widget} />)
                    )}
                </div>
            )}
        </ServerContentBlock>
    );
};

export default DashboardContainer;
