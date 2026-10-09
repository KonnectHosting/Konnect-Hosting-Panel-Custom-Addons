import React, { useEffect } from 'react';
import FlashMessageRender from '@/components/FlashMessageRender';
import PageContentBlock from '@/components/elements/PageContentBlock';
import tw from 'twin.macro';
import { useSSHKeys } from '@/api/account/ssh-keys';
import { useFlashKey } from '@/plugins/useFlash';
import { format } from 'date-fns';
import CreateSSHKeyForm from '@/components/dashboard/ssh/CreateSSHKeyForm';
import DeleteSSHKeyButton from '@/components/dashboard/ssh/DeleteSSHKeyButton';
import { useTranslation } from 'react-i18next';
import ItemList, { ItemRow, ItemCell } from '@/components/elements/ItemList';
import Spinner from '@/components/elements/Spinner';

export default () => {
    const { t } = useTranslation('arix/account');
    const { clearAndAddHttpError } = useFlashKey('account');
    const { data, isValidating, error } = useSSHKeys({
        revalidateOnMount: true,
        revalidateOnFocus: false,
    });

    useEffect(() => {
        clearAndAddHttpError(error);
    }, [error]);

    useEffect(() => {
        if (isValidating) clearAndAddHttpError();
    }, [isValidating]);

    return (
        <>
            <FlashMessageRender byKey={'account'} />
            <PageContentBlock title={t('sshKey.ssh-keys')}>
                <ItemList
                    title={
                        <div className={'flex lg:flex-row flex-col gap-2 items-start justify-between'}>
                            <div>
                                <p className={'text-medium text-gray-300'}>{t('sshKey.ssh-keys')}</p>
                            </div>
                            <CreateSSHKeyForm />
                        </div>
                    }
                    headers={
                        <tr>
                            <th>{t('sshKey.name')}</th>
                            <th>{t('sshKey.fingerprint')}</th>
                            <th>{t('sshKey.created-at')}</th>
                            <th />
                        </tr>
                    }
                >
                    {!data || !data.length ? (
                        <ItemRow>
                            <ItemCell colSpan={4} className={`text-center text-sm`}>
                                {!data ? <Spinner /> : t('sshKey.no-key-found')}
                            </ItemCell>
                        </ItemRow>
                    ) : (
                        data.map((key) => (
                            <ItemRow key={key.fingerprint}>
                                <ItemCell>{key.name}</ItemCell>
                                <ItemCell>
                                    <code css={tw`font-mono text-sm py-1 px-2 bg-neutral-900 rounded`}>
                                        SHA256:{key.fingerprint}
                                    </code>
                                </ItemCell>
                                <ItemCell>{format(key.createdAt, 'MMM do, yyyy HH:mm')}</ItemCell>
                                <ItemCell css={tw`text-right`}>
                                    <DeleteSSHKeyButton name={key.name} fingerprint={key.fingerprint} />
                                </ItemCell>
                            </ItemRow>
                        ))
                    )}
                </ItemList>
            </PageContentBlock>
        </>
    );
};
