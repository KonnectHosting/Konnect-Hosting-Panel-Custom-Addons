import React, { useEffect, useState } from 'react';
import CreateApiKeyForm from '@/components/dashboard/account/forms/CreateApiKeyForm';
import getApiKeys, { ApiKey } from '@/api/account/getApiKeys';
import deleteApiKey from '@/api/account/deleteApiKey';
import { format } from 'date-fns';
import tw from 'twin.macro';
import { Dialog } from '@/components/elements/dialog';
import { useFlashKey } from '@/plugins/useFlash';
import Code from '@/components/elements/Code';
import { useTranslation } from 'react-i18next';
import PageContentBlock from '@/components/elements/PageContentBlock';
import { Button } from '@/components/elements/button/index';
import ItemList, { ItemRow, ItemCell } from '@/components/elements/ItemList';
import { TrashIcon } from '@heroicons/react/outline';
import Spinner from '@/components/elements/Spinner';

export default () => {
    const { t } = useTranslation('arix/account');
    const [deleteIdentifier, setDeleteIdentifier] = useState('');
    const [keys, setKeys] = useState<ApiKey[]>([]);
    const [loading, setLoading] = useState(true);
    const { clearAndAddHttpError } = useFlashKey('account');

    useEffect(() => {
        getApiKeys()
            .then((keys) => setKeys(keys))
            .then(() => setLoading(false))
            .catch((error) => clearAndAddHttpError(error));
    }, []);

    const doDeletion = (identifier: string) => {
        setLoading(true);

        clearAndAddHttpError();
        deleteApiKey(identifier)
            .then(() => setKeys((s) => [...(s || []).filter((key) => key.identifier !== identifier)]))
            .catch((error) => clearAndAddHttpError(error))
            .then(() => {
                setLoading(false);
                setDeleteIdentifier('');
            });
    };

    return (
        <PageContentBlock title={t('apiKey.title')}>
            <Dialog.Confirm
                title={t('apiKey.delete-api-key')}
                confirm={t('apiKey.delete-key')}
                open={!!deleteIdentifier}
                onClose={() => setDeleteIdentifier('')}
                onConfirmed={() => doDeletion(deleteIdentifier)}
            >
                {t('apiKey.all-requests-invalidated-1')}&nbsp;
                <Code>{deleteIdentifier}</Code>&nbsp;
                {t('apiKey.all-requests-invalidated-2')}
            </Dialog.Confirm>
            <ItemList
                title={
                    <div className={'flex lg:flex-row flex-col gap-2 items-start justify-between'}>
                        <div>
                            <p className={'text-medium text-gray-300'}>{t('apiKey.title')}</p>
                        </div>
                        <CreateApiKeyForm onKeyCreated={(key) => setKeys((s) => [...s!, key])} />
                    </div>
                }
                headers={
                    <tr>
                        <th>{t('apiKey.identifier')}</th>
                        <th>{t('apiKey.label')}</th>
                        <th>{t('apiKey.last-used')}</th>
                        <th>{t('apiKey.expiresAt')}</th>
                        <th />
                    </tr>
                }
            >
                {keys.length === 0 ? (
                    <ItemRow>
                        <ItemCell colSpan={5} className={`text-center text-sm`}>
                            {loading ? <Spinner /> : t('apiKey.no-key-found')}
                        </ItemCell>
                    </ItemRow>
                ) : (
                    keys.map((key) => (
                        <ItemRow key={key.identifier}>
                            <ItemCell>
                                <code css={tw`font-mono py-1 px-2 bg-neutral-900 rounded`}>{key.identifier}</code>
                            </ItemCell>
                            <ItemCell>{key.description}</ItemCell>
                            <ItemCell>
                                {key.lastUsedAt ? format(key.lastUsedAt, 'MMM do, yyyy HH:mm') : t('apiKey.never')}
                            </ItemCell>
                            <ItemCell>{key.expiresAt ? format(key.expiresAt, 'MMM do, yyyy') : t('apiKey.never')}</ItemCell>
                            <ItemCell className='text-end'>
                                <Button.Danger
                                    onClick={() => setDeleteIdentifier(key.identifier)}
                                    variant={Button.Variants.Secondary}
                                >
                                    <TrashIcon className='w-4' />
                                </Button.Danger>
                            </ItemCell>
                        </ItemRow>
                    ))
                )}
            </ItemList>
        </PageContentBlock>
    );
};
