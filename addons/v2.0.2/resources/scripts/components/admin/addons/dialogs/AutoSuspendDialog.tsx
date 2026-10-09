import React, { useState } from 'react';
import { Dialog } from '@/components/elements/dialog';
import { Button } from '@/components/elements/button/index';
import Spinner from '@/components/elements/Spinner';
import Switch from '@/components/elements/Switch';
import { AddonSettings, updateAddon } from '@/api/admin/Addons';
import useFlash from '@/plugins/useFlash';
import { httpErrorToHuman } from '@/api/http';

interface Props {
    open: boolean;
    data: AddonSettings;
    onClose: () => void;
    onSave: (data: AddonSettings) => void;
}

export default ({ open, data, onClose, onSave }: Props) => {
    const [enabled, setEnabled] = useState(data.enabled);
    const [saving, setSaving] = useState(false);
    const { addFlash, clearFlashes } = useFlash();

    const handleSave = async () => {
        setSaving(true);
        clearFlashes();
        try {
            const result = await updateAddon('autoSuspend', { enabled });
            onSave(result);
            onClose();
        } catch (err) {
            addFlash({ type: 'error', message: httpErrorToHuman(err) });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} title='Auto Suspend'>
            <div className='flex items-center justify-between mb-4'>
                <p>Enable Auto Suspend</p>
                <Switch name='enabled' checked={enabled} onChange={() => setEnabled((v) => !v)} />
            </div>
            <Dialog.Footer>
                <Button.Text onClick={onClose}>Cancel</Button.Text>
                <Button onClick={handleSave} disabled={saving} className='flex items-center gap-x-2'>
                    Save
                    {saving && <Spinner size='small' />}
                </Button>
            </Dialog.Footer>
        </Dialog>
    );
};
