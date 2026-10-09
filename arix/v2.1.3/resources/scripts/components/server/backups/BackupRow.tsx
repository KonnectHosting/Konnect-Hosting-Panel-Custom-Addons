import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEllipsisH } from '@fortawesome/free-solid-svg-icons';
import { formatDistanceToNow } from 'date-fns';
import Spinner from '@/components/elements/Spinner';
import { bytesToString } from '@/lib/formatters';
import Can from '@/components/elements/Can';
import useWebsocketEvent from '@/plugins/useWebsocketEvent';
import BackupContextMenu from '@/components/server/backups/BackupContextMenu';
import tw from 'twin.macro';
import CopyOnClick from '@/components/elements/CopyOnClick';
import getServerBackups from '@/api/swr/getServerBackups';
import { ServerBackup } from '@/api/server/types';
import { SocketEvent } from '@/components/server/events';
import { ArchiveIcon, LockClosedIcon } from '@heroicons/react/outline';
import { useTranslation } from 'react-i18next';
import * as locales from 'date-fns/locale';
import { ItemCell, ItemRow } from '@/components/elements/ItemList';

const getLocale = (localeKey: keyof typeof locales) => {
    if (locales[localeKey]) {
        return locales[localeKey];
    } else {
        const keyString = String(localeKey);
        console.warn(`Locale '${keyString}' not found. Falling back to '${locales.enUS}'`);
        return locales.enUS;
    }
};

interface Props {
    backup: ServerBackup;
    className?: string;
}

export default ({ backup, className }: Props) => {
    const { t } = useTranslation('arix/server/backups');
    const { mutate } = getServerBackups();
    const { i18n } = useTranslation();
    const currentLang = i18n.language;
    const localeKey = currentLang as keyof typeof locales;

    useWebsocketEvent(`${SocketEvent.BACKUP_COMPLETED}:${backup.uuid}` as SocketEvent, (data) => {
        try {
            const parsed = JSON.parse(data);

            mutate(
                (data) => ({
                    ...data,
                    items: data.items.map((b) =>
                        b.uuid !== backup.uuid
                            ? b
                            : {
                                  ...b,
                                  isSuccessful: parsed.is_successful || true,
                                  checksum: (parsed.checksum_type || '') + ':' + (parsed.checksum || ''),
                                  bytes: parsed.file_size || 0,
                                  completedAt: new Date(),
                              }
                    ),
                }),
                false
            );
        } catch (e) {
            console.warn(e);
        }
    });

    return (
        <>
            <ItemRow>
                <ItemCell>
                    <div className={'flex items-center gap-x-2'}>
                        {backup.completedAt !== null ? (
                            backup.isLocked ? (
                                <LockClosedIcon css={tw`text-danger-200 w-5`} />
                            ) : (
                                <ArchiveIcon css={tw`text-neutral-300 w-5`} />
                            )
                        ) : (
                            <Spinner size={'small'} />
                        )}
                        {backup.name}
                        {backup.completedAt !== null && !backup.isSuccessful && (
                            <span
                                css={tw`bg-danger-200 py-px px-2 rounded-full text-danger-50 text-xs uppercase border border-red-600 mr-2`}
                            >
                                {t('failed')}
                            </span>
                        )}
                    </div>
                </ItemCell>
                <ItemCell>
                    {backup.completedAt !== null && backup.isSuccessful && <span>{bytesToString(backup.bytes)}</span>}
                </ItemCell>
                <ItemCell>
                    {formatDistanceToNow(backup.createdAt, {
                        includeSeconds: true,
                        addSuffix: true,
                        locale: getLocale(localeKey),
                    })}
                </ItemCell>
                <ItemCell>
                    <CopyOnClick text={backup.checksum}>
                        <p className={'max-w-[250px] overflow-hidden overflow-ellipsis'}>{backup.checksum}</p>
                    </CopyOnClick>
                </ItemCell>
                <ItemCell className={'w-1'}>
                    <Can action={['backup.download', 'backup.restore', 'backup.delete']} matchAny>
                        <div css={tw`mt-4 md:mt-0 ml-6`} style={{ marginRight: '-0.5rem' }}>
                            {!backup.completedAt ? (
                                <div css={tw`p-2 invisible`}>
                                    <FontAwesomeIcon icon={faEllipsisH} />
                                </div>
                            ) : (
                                <BackupContextMenu backup={backup} />
                            )}
                        </div>
                    </Can>
                </ItemCell>
            </ItemRow>
        </>
    );
};
