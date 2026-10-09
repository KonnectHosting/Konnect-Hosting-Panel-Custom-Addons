import React, { useEffect, useState } from 'react';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import tw from 'twin.macro';
import TitledGreyBox from '@/components/elements/TitledGreyBox';
import { Button } from '@/components/elements/button/index';
import SetupTOTPDialog from '@/components/dashboard/account/forms/SetupTOTPDialog';
import RecoveryTokensDialog from '@/components/dashboard/account/forms/RecoveryTokensDialog';
import DisableTOTPDialog from '@/components/dashboard/account/forms/DisableTOTPDialog';
import { useFlashKey } from '@/plugins/useFlash';
import { ShieldCheckIcon, ShieldExclamationIcon } from '@heroicons/react/outline';
import { useTranslation } from 'react-i18next';

export default () => {
    const { t } = useTranslation('arix/account');
    const [tokens, setTokens] = useState<string[]>([]);
    const [visible, setVisible] = useState<'enable' | 'disable' | null>(null);
    const isEnabled = useStoreState((state: ApplicationStore) => state.user.data!.useTotp);
    const { clearAndAddHttpError } = useFlashKey('account:two-step');

    useEffect(() => {
        return () => {
            clearAndAddHttpError();
        };
    }, [visible]);

    const onTokens = (tokens: string[]) => {
        setTokens(tokens);
        setVisible(null);
    };

    return (
        <TitledGreyBox
            title={
                <p className={'font-medium text-gray-300 flex items-center gap-x-2'}>
                    {isEnabled ? (
                        <ShieldCheckIcon className={'w-5 text-success-100'} />
                    ) : (
                        <ShieldExclamationIcon className={'w-5 text-danger-100'} />
                    )}
                    {t('twofactor.title')}
                </p>
            }
        >
            <SetupTOTPDialog open={visible === 'enable'} onClose={() => setVisible(null)} onTokens={onTokens} />
            <RecoveryTokensDialog tokens={tokens} open={tokens.length > 0} onClose={() => setTokens([])} />
            <DisableTOTPDialog open={visible === 'disable'} onClose={() => setVisible(null)} />
            <p css={tw`text-sm`}>{isEnabled ? t('twofactor.isEnabled') : t('twofactor.isDisabled')}</p>
            <div css={tw`mt-6 text-right`}>
                {isEnabled ? (
                    <Button.Danger onClick={() => setVisible('disable')}>{t('twofactor.disable')}</Button.Danger>
                ) : (
                    <Button onClick={() => setVisible('enable')}>{t('twofactor.enable')}</Button>
                )}
            </div>
        </TitledGreyBox>
    );
};
