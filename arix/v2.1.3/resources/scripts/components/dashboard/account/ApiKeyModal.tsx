import React, { useContext } from 'react';
import tw from 'twin.macro';
import { Button } from '@/components/elements/button/index';
import CopyOnClick from '@/components/elements/CopyOnClick';
import { useTranslation } from 'react-i18next';
import asDialog from '@/hoc/asDialog';
import { DialogWrapperContext } from '@/components/elements/dialog/context';
import { Dialog } from '@/components/elements/dialog';

interface Props {
    apiKey: string;
}

const ApiKeyModal = ({ apiKey }: Props) => {
    const { t } = useTranslation('arix/account');
    const { close } = useContext(DialogWrapperContext);

    return (
        <>
            <p css={tw`text-sm mb-6`}>{t('apiKey.store-save')}</p>
            <pre css={tw`text-sm bg-neutral-900 rounded py-2 px-4 font-mono`}>
                <CopyOnClick text={apiKey}>
                    <code css={tw`font-mono`}>{apiKey}</code>
                </CopyOnClick>
            </pre>
            <Dialog.Footer>
                <Button.Text onClick={close}>{t('apiKey.close')}</Button.Text>
            </Dialog.Footer>
        </>
    );
};

ApiKeyModal.displayName = 'ApiKeyModal';

export default asDialog(() => {
    const { t } = useTranslation('arix/account');
    return {
        title: t('apiKey.title'),
    };
})(ApiKeyModal);
