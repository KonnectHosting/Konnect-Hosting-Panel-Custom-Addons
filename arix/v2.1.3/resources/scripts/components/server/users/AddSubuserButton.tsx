import React, { useState } from 'react';
import EditSubuserModal from '@/components/server/users/EditSubuserModal';
import { Button } from '@/components/elements/button/index';
import { useTranslation } from 'react-i18next';

export default () => {
    const { t } = useTranslation('arix/server/users');
    const [visible, setVisible] = useState(false);

    return (
        <>
            <EditSubuserModal open={visible} onClose={() => setVisible(false)} />
            <Button onClick={() => setVisible(true)}>{t('new-user')}</Button>
        </>
    );
};
