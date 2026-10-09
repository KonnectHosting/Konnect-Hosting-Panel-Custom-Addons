import React, { useEffect, useState } from "react";
import ServerContentBlock from "@/components/elements/ServerContentBlock";
import { BriefcaseIcon, ExternalLinkIcon } from "@heroicons/react/outline";
import { activate, deactivate } from "@/api/server/fivem/txadmin";
import { ServerContext } from "@/state/server";
import getServerStartup from "@/api/swr/getServerStartup";
import { useStoreActions, useStoreState } from "easy-peasy";
import { Button, styles } from "@/components/elements/button/index";
import classNames from "classnames";
import TitledGreyBox from "@/components/elements/TitledGreyBox";
import deleteFiles from "@/api/server/files/deleteFiles";
import { ApplicationStore } from "@/state";
import { useTranslation } from "react-i18next";

export default function () {
    const { t } = useTranslation('arix/server/addons/fivem');
    const [enabled, setEnabled] = useState<boolean>(false);
    const [port, setPort] = useState<number | null>(null);
    const {identifier: id, uuid} = ServerContext.useStoreState((state) => state.server.data!);
    const { data: startup, mutate: mutateStartup } = getServerStartup(uuid);
    const { clearFlashes, addFlash } = useStoreActions((actions) => actions.flashes);
    const { txAdminLogin, txAdminSetup, cacheDelete } = useStoreState((state: ApplicationStore) => state.settings.data!.addons.fivemUtils);
    
    const allocation = ServerContext.useStoreState((state) => {
        const match = state.server.data?.allocations.find((allocation) => allocation.isDefault);

        return !match ? 'n/a' : `${match.ip}`;
    });


    useEffect(() => {
        setEnabled(startup?.variables.find((v) => v.envVariable === 'TXADMIN_ENABLE')?.serverValue === '1');
        setPort(Number(startup?.variables.find((v) => v.envVariable === 'TXHOST_TXA_PORT')?.serverValue));
    }, [startup]);

    const activateTxAdmin = () => {
        activate(id)
            .then((response) => {
                setPort(response.attributes.port);
                setEnabled(true);
                addFlash({ key: 'server:fivem', type: 'success', message: t('txAdmin.success') });
                return mutateStartup();
            })
            .catch(() => {
                addFlash({ key: 'server:fivem', type: 'error', message: 'Failed to activate TxAdmin.' });
            });
    }
    const deactivateTxAdmin = () => {
        deactivate(id)
            .then(() => {
                setPort(null);
                setEnabled(false);
                addFlash({ key: 'server:fivem', type: 'success', message: t('txAdmin.deactivate_success') });
                return mutateStartup();
            })
            .catch(() => {
                addFlash({ key: 'server:fivem', type: 'error', message: 'Failed to deactivate TxAdmin.' });
            });
    }

    const clearCache = () => {
        deleteFiles(uuid, '/', ['cache'])
            .then(() => {
                addFlash({ key: 'server:fivem', type: 'success', message: t('cache.success') });
            })
            .catch((error) => {
                addFlash({ key: 'server:fivem', type: 'error', message: 'Failed to clear cache: ' + error.message });
            });
    }

    return (
        <ServerContentBlock showFlashKey={'server:fivem'} title={t('title')} icon={BriefcaseIcon}>
            <div className="grid lg:grid-cols-2 gap-4">
                {(txAdminSetup || txAdminLogin) && (
                    <TitledGreyBox title={t('txAdmin.title')}>
                        <p className={'text-gray-300 text-sm'}>
                            {t('txAdmin.description')}
                        </p>
                        <div className={'flex items-center justify-end gap-x-2 mt-4'}>
                            {txAdminSetup && !enabled ? (
                                <Button onClick={activateTxAdmin}>{t('txAdmin.activate')}</Button>
                            ) : (
                                <Button.Danger onClick={deactivateTxAdmin}>{t('txAdmin.deactivate')}</Button.Danger>
                            )}
                            {txAdminLogin && enabled && port && allocation && (
                                <a 
                                    href={`http://${allocation}:${port}`} 
                                    target="_blank" 
                                    className={classNames(styles.button, styles.text, 'gap-x-2')}
                                    rel="noopener noreferrer"
                                >
                                    {t('txAdmin.open_txadmin')}
                                    <ExternalLinkIcon className={'w-5'} />
                                </a>
                            )}
                        </div>
                    </TitledGreyBox>
                )}
                {cacheDelete && (
                    <TitledGreyBox title={t('cache.title')}>
                        <p className="text-sm">{t('cache.description')}</p>
                        <div className="flex justify-end mt-4">
                            <Button.Text onClick={clearCache}>{t('cache.clear_cache')}</Button.Text>
                        </div>
                    </TitledGreyBox>
                )}
            </div>
        </ServerContentBlock>
    )
}