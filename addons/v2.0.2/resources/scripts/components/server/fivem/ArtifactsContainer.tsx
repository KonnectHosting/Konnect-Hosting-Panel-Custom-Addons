import React, { useEffect, useState } from 'react';
import getArtifacts, { Artifact, Artifacts } from '@/api/server/fivem/artifacts';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import { differenceInHours, format, formatDistanceToNow } from 'date-fns';
import Spinner from '@/components/elements/Spinner';
import { CollectionIcon } from '@heroicons/react/outline';
import { ServerContext } from '@/state/server';
import { Button } from '@/components/elements/button/index';
import { Dialog } from '@/components/elements/dialog';
import getServerStartup from '@/api/swr/getServerStartup';
import updateStartupVariable from '@/api/server/updateStartupVariable';
import reinstallServer from '@/api/server/reinstallServer';
import useFlash from '@/plugins/useFlash';
import { httpErrorToHuman } from '@/api/http';
import Badge from '@/components/elements/Badge';
import { useTranslation } from 'react-i18next';
import * as locales from 'date-fns/locale';

const getLocale = (localeKey: keyof typeof locales) => {
    if (locales[localeKey]) {
        return locales[localeKey];
    } else {
        const keyString = String(localeKey);
        console.warn(`Locale '${keyString}' not found. Falling back to '${locales.enUS}'`);
        return locales.enUS;
    }
};

const FLASH_KEY = 'server:artifacts';
const FIVEM_VERSION_VARIABLE = 'FIVEM_VERSION';

interface ArtifactsCardProps {
    artifact: Artifact;
    isCurrent: boolean;
    isInstalling: boolean;
    onInstall: (artifact: Artifact) => void;
}

const ArtifactsCard = ({ artifact, isCurrent, isInstalling, onInstall }: ArtifactsCardProps) => {
    const { t } = useTranslation('arix/server/addons/artifacts');
    const { i18n } = useTranslation();
    const currentLang = i18n.language;
    const localeKey = currentLang as keyof typeof locales;
    const isSpecial = artifact.releaseDate === 'Latest' || artifact.releaseDate === 'Optional';
    const releaseDate = isSpecial ? artifact.releaseDate : new Date(artifact.releaseDate);
    const parsedReleaseDate = releaseDate instanceof Date ? releaseDate : new Date();

    return (
        <div className={`relative rounded-box bg-neutral-700 backdrop boxBorder px-6 py-5 ${isSpecial ? 'lg:col-span-2 md:col-span-1 lg:flex items-center justify-between' : ''}`}>
            {isCurrent && (
                <div className={'absolute -top-3 left-4 bg-gray-600 px-2 py-1 rounded-component text-sm'}>
                    {t('current')}
                </div>
            )}
            <div className='flex items-center gap-x-2'>
                <h3 className={'text-lg font-medium text-gray-100'}>{artifact.id}</h3>
                {isSpecial && (
                    <div>
                        <Badge color='info'>
                            {artifact.releaseDate === 'Latest' ? t('recommended') : t('optional')}
                        </Badge>
                    </div>
                )}
            </div>
            {!isSpecial && (
                <p className='mb-2'>
                    {Math.abs(differenceInHours(parsedReleaseDate, new Date())) > 48
                        ? format(parsedReleaseDate, 'MMM do, yyyy h:mma', { locale: getLocale(localeKey) })
                        : formatDistanceToNow(parsedReleaseDate, { addSuffix: true, locale: getLocale(localeKey) })}
                </p>
            )}
            <div className='flex justify-end'>
                <Button
                    onClick={() => onInstall(artifact)}
                    disabled={isCurrent || isInstalling}
                    className={'flex items-center gap-x-2'}
                >
                    {isInstalling && <Spinner size={'small'} />}
                    {t('install')}
                </Button>
            </div>
        </div>
    )
};

export default function ArtifactsContainer() {
    const { t } = useTranslation('arix/server/addons/artifacts');
    const [data, setData] = useState<Artifacts | null>(null);
    const [installingBuildId, setInstallingBuildId] = useState<string | null>(null);
    const [installedArtifact, setInstalledArtifact] = useState<Artifact | null>(null);
    const [isReinstalling, setIsReinstalling] = useState(false);
    const { id, uuid } = ServerContext.useStoreState((state) => state.server.data!);
    const { addFlash, clearFlashes, clearAndAddHttpError } = useFlash();
    const { data: startup, mutate: mutateStartup } = getServerStartup(uuid);

    useEffect(() => {
        getArtifacts(id).then((response) => {
            setData(response.data);
        }).catch((error) => {
            console.error('Failed to fetch artifacts:', error);
            clearAndAddHttpError({ error, key: FLASH_KEY });
        });
    }, [id]);

    const currentVersion = startup?.variables.find((v) => v.envVariable === FIVEM_VERSION_VARIABLE)?.serverValue ?? null;

    const onInstall = (artifact: Artifact) => {
        const buildId = artifact.releaseDate === 'Latest' ? 'recommended' : artifact.buildId;
        clearFlashes(FLASH_KEY);
        setInstallingBuildId(artifact.buildId);

        updateStartupVariable(uuid, FIVEM_VERSION_VARIABLE, buildId)
            .then(([variable, invocation]) => {
                mutateStartup(
                    (data) =>
                        data && {
                            ...data,
                            invocation,
                            variables: data.variables.map((v) => (v.envVariable === variable.envVariable ? variable : v)),
                        },
                    false
                );
                setInstalledArtifact(artifact);
            })
            .catch((error) => {
                console.error(error);
                clearAndAddHttpError({ error, key: FLASH_KEY });
            })
            .finally(() => setInstallingBuildId(null));
    };

    const onReinstall = () => {
        setIsReinstalling(true);
        reinstallServer(uuid)
            .then(() => {
                addFlash({
                    key: FLASH_KEY,
                    type: 'success',
                    message: 'Your server is being reinstalled.',
                });
                setInstalledArtifact(null);
            })
            .catch((error) => {
                console.error(error);
                addFlash({ key: FLASH_KEY, type: 'error', message: httpErrorToHuman(error) });
            })
            .finally(() => setIsReinstalling(false));
    };

    return (
        <ServerContentBlock showFlashKey={'server:artifacts'} title={'Artifacts'} icon={CollectionIcon}>
            <Dialog
                open={installedArtifact !== null}
                onClose={() => setInstalledArtifact(null)}
                    title={t('successfully_installed')}
                    description={t('reinstall_your_server', { version: installedArtifact?.id })}
            >
                <Dialog.Footer>
                    <Button.Text onClick={() => setInstalledArtifact(null)}>
                        {t('close')}
                    </Button.Text>
                    <Button.Danger onClick={onReinstall} disabled={isReinstalling} className={'flex items-center gap-x-2'}>
                        {isReinstalling && <Spinner size={'small'} />}
                        {t('reinstall_now')}
                    </Button.Danger>
                </Dialog.Footer>
            </Dialog>

            {!data ? (
                <Spinner size={'large'} centered />
            ) : (
                <div className='grid lg:grid-cols-4 md:grid-cols-2 gap-4'>
                    <ArtifactsCard
                        artifact={data.recommended}
                        isCurrent={currentVersion === 'recommended' || currentVersion === data.recommended.buildId}
                        isInstalling={installingBuildId === data.recommended.buildId}
                        onInstall={onInstall}
                    />
                    <ArtifactsCard
                        artifact={data.optional}
                        isCurrent={currentVersion === data.optional.buildId}
                        isInstalling={installingBuildId === data.optional.buildId}
                        onInstall={onInstall}
                    />

                    {Object.entries(data.allVersions).map(([version, artifact]) => (
                        <ArtifactsCard
                            key={version}
                            artifact={artifact}
                            isCurrent={currentVersion === artifact.buildId}
                            isInstalling={installingBuildId === artifact.buildId}
                            onInstall={onInstall}
                        />
                    ))}
                </div>
            )}
        </ServerContentBlock>
    );
}
