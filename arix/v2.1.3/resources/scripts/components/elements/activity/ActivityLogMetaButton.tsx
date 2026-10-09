import React, { useState } from 'react';
import { ClipboardListIcon } from '@heroicons/react/outline';
import { Dialog } from '@/components/elements/dialog';
import { Button } from '@/components/elements/button/index';
import { useTranslation } from 'react-i18next';

export default ({ meta }: { meta: Record<string, unknown> }) => {
    const { t } = useTranslation('arix/activity');
    const [open, setOpen] = useState(false);

    return (
        <div className={'self-center md:px-4'}>
            <Dialog open={open} onClose={() => setOpen(false)} hideCloseIcon title={t('metadata')}>
                <pre
                    className={
                        'bg-gray-900 rounded p-2 font-mono text-sm leading-relaxed overflow-x-scroll whitespace-pre-wrap'
                    }
                >
                    {JSON.stringify(meta, null, 2)}
                </pre>
                <Dialog.Footer>
                    <Button.Text onClick={() => setOpen(false)}>{t('close')}</Button.Text>
                </Dialog.Footer>
            </Dialog>
            <Button.Text
                aria-describedby={'View additional event metadata'}
                onClick={() => setOpen(true)}
                size={Button.Sizes.Small}
            >
                <ClipboardListIcon className={'w-5 h-5'} />
            </Button.Text>
        </div>
    );
};
