import React from 'react';
import UpdateProfileForm from '@/components/dashboard/account/forms/UpdateProfileForm';
import AppearanceWrapper from '@/components/dashboard/account/forms/AppearanceWrapper';
import PageContentBlock from '@/components/elements/PageContentBlock';
import { useTranslation } from 'react-i18next';

export default () => {
    const { t } = useTranslation('arix/account');

    return (
        <PageContentBlock title={t('account-overview')} className='space-y-4'>
            <UpdateProfileForm />
            <AppearanceWrapper />
        </PageContentBlock>
    );
};
