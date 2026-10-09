import React, { useState, useEffect } from 'react';
import FlashMessageRender from '@/components/FlashMessageRender';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import getEngines from '@/api/server/versions/getEngines';
import { ServerContext } from '@/state/server';
import Spinner from '@/components/elements/Spinner';
import { useTranslation } from 'react-i18next';
import { HiOutlineCollection } from "react-icons/hi";
import useFlash from '@/plugins/useFlash';
import classNames from 'classnames';
import { Button, styles } from '@/components/elements/button/index';
import { Dialog } from '@/components/elements/dialog';
import getVersions from '@/api/server/versions/getVersions';
import Select from '@/components/elements/Select';
import setVersion from '@/api/server/versions/setVersion';
import Input from '@/components/elements/Input';
import { ExclamationIcon } from '@heroicons/react/outline';
import Badge from '@/components/elements/Badge';
import Label from '@/components/elements/Label';

const VersionsContainer = () => {
    const { t } = useTranslation('arix/server/addons/versions');
    const { addFlash, clearFlashes } = useFlash();
    const id = ServerContext.useStoreState((state) => state.server.data!.identifier);
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const [engines, setEngines] = useState<string[]>([]);
    const [current, setCurrent] = useState<{ engine: string; version: string }>({ engine: '', version: '' });
    const [selectedEngine, setSelectedEngine] = useState<string | null>(null);
    const [versions, setVersions] = useState<{ version: string; download_url: string }[]>([]);
    const [uninstall, setUninstall] = useState(false);
    const [selectedVersion, setSelectedVersion] = useState<string>('');
    const [isInstalling, setIsInstalling] = useState(false);

    useEffect(() => {
        getEngines(id)
            .then((engines) => {
                setEngines(engines.data);
                setCurrent({
                    engine: engines.current.service,
                    version: engines.current.version,
                });
            })
            .catch((error) => {
                addFlash({
                    type: 'error',
                    key: 'versions',
                    message: error.message,
                });
            });
    }, [id]);

    useEffect(() => {
        if (!selectedEngine) return;
        getVersions(id, selectedEngine)
            .then((versions) => {
                setVersions(versions.data);
                if (versions.data.length > 0) {
                    setSelectedVersion(versions.data[0].version);
                }
            })
            .catch((error) => {
                addFlash({
                    type: 'error',
                    key: 'versions',
                    message: error.message,
                });
            });
    }, [id, selectedEngine]);

    const onCloseDialog = () => {
        setSelectedEngine(null);
        setVersions([]);
        setSelectedVersion('');
        setUninstall(false);
    };
    const Install = () => {
        clearFlashes('versions');

        const version = selectedVersion;
        if (!versions.find((v) => v.version === selectedVersion)?.download_url) {
            addFlash({ type: 'error', key: 'versions', message: 'Selected version has no download URL.' });
            return;
        }

        setIsInstalling(true);

        setVersion({ uuid, id, engine: selectedEngine!, version, uninstall })
            .then(() => {
                addFlash({
                    type: 'success',
                    key: 'versions',
                    message: `${selectedEngine} ${version} ${t('succesfully-installed')}.`,
                });
                setCurrent({ engine: selectedEngine!, version });
                onCloseDialog();
            })
            .catch((error) => {
                addFlash({
                    type: 'error',
                    key: 'versions',
                    message: error.message,
                });
            })
            .finally(() => {
                setIsInstalling(false);
            });
    };


    return (
        <ServerContentBlock 
            title={t('versions')} 
            icon={HiOutlineCollection}
        >
            <FlashMessageRender byKey={'versions'} />

            <Dialog
                open={selectedEngine !== null}
                onClose={onCloseDialog}
                title={`${t('browse_versions')} ${selectedEngine}`}
                description={t('browse_versions_desc')}
            >
                {!versions || versions.length === 0 ? (
                    <div className="flex items-center justify-center">
                        <Spinner size={'large'} />
                    </div>
                ) : (
                    <React.Fragment>
                        <Label className="mt-2">{t('select-a-version')}</Label>
                        <Select autoFocus onChange={(e) => setSelectedVersion(e.target.value)} value={selectedVersion}>
                            {versions.map((version) => (
                                <option
                                    key={version.version}
                                    value={version.version}
                                >
                                    {version.version}
                                </option>
                            ))}
                        </Select>
                    </React.Fragment>
                )}
                <label
                    className='flex gap-x-3 items-center px-4 py-3 bg-neutral-600 !border-neutral-500 hover:border-neutral-400 text-neutral-200 duration-300 rounded-component mt-4' 
                    style={{ border: "var(--borderInput)" }}
                >
                    <Input
                        type="checkbox"
                        checked={uninstall}
                        onChange={(e) => setUninstall(e.target.checked)}
                    />
                    <div>
                        <p className='flex items-center gap-x-2 font-medium'>
                            <ExclamationIcon className={'w-5 text-danger-100'} />
                            {t('danger-zone')}
                        </p>
                        <p className="text-sm">{t('reset-your-server')}</p>
                    </div>
                </label>
                <Dialog.Footer>
                    <Button.Text onClick={onCloseDialog}>
                        {t('cancel')}
                    </Button.Text>
                    <Button 
                        onClick={Install} disabled={isInstalling || versions.length === 0 || !selectedVersion}
                        className={'flex items-center gap-x-2'}
                    >
                        {isInstalling && <Spinner size={'small'} />} {t('install')}
                    </Button>
                </Dialog.Footer>
            </Dialog>

            {engines.length === 0 ? (
                <div className="flex items-center justify-center">
                    <Spinner size={'large'} />
                </div>
            ) : (
                <React.Fragment>
                    {current.engine && current.version && (
                        <div className="relative bg-gray-700 backdrop boxBorder rounded-box px-6 py-5 flex items-center mb-4">
                            <div className="absolute -top-4 bg-gray-600 px-2 py-1 rounded-component text-sm">
                                {t('current')}
                            </div>
                            <img 
                                src={`/addons/${current.engine.split(' ')[0].toLowerCase()}.png`}
                                width={40}
                                height={40}
                                alt={current.engine}
                                className="mr-4"
                            />
                            <div>
                                <p className="font-medium text-lg">{current.engine}</p>
                                <span className="text-gray-300">{current.version}</span>
                            </div>
                            <Button.Text onClick={() => setSelectedEngine(current.engine)} className="ml-auto">
                                {t('browse_versions')}
                            </Button.Text>
                        </div>
                    )}
                    <div className="grid lg:grid-cols-3 gap-4">
                        {engines.map((engine) => (
                            <div 
                                className="group cursor-pointer bg-gray-700 backdrop boxBorder rounded-box px-6 py-5 flex items-center gap-x-2" 
                                key={engine}
                                onClick={() => setSelectedEngine(engine)}
                            >
                                <img 
                                    src={`/addons/${engine.split(' ')[0].toLowerCase()}.png`} 
                                    width={24} 
                                    height={24} 
                                    alt={engine}
                                />
                                <div className="flex items-center gap-x-2">

                                    <p className="text-lg font-medium">
                                        {engine}
                                    </p>
                                    {engine === current.engine && 
                                        <div className="bg-gray-600 px-2 py-1 rounded-component text-sm">
                                            {t('current')}
                                        </div>
                                    }
                                </div>
                                <div className={classNames(styles.button, styles.text, 'ml-auto group-hover:bg-secondary-100')}>
                                    {t('browse')}
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className='text-sm text-grey-400 flex items-center gap-x-2 mt-2'>
                        {t('powered-by')}
                        <a href="https://mcjars.app?ref=arix-theme" target="_blank" rel="noopener noreferrer" className="flex items-center gap-x-1">
                            <img src={'/addons/vanilla.png'} width={24} height={24} alt='Mcjars' />
                            <span className='font-bold text-gray-50'>MCJars</span>
                        </a>
                    </p>
                </React.Fragment>
            )}
        </ServerContentBlock>
    );
};

export default VersionsContainer;