import React, { useState } from 'react';
import { Dialog } from '@/components/elements/dialog';
import { Button } from '@/components/elements/button/index';
import Spinner from '@/components/elements/Spinner';
import Switch from '@/components/elements/Switch';
import Label from '@/components/elements/Label';
import { AddonSettings, updateAddon } from '@/api/admin/Addons';
import useFlash from '@/plugins/useFlash';
import { httpErrorToHuman } from '@/api/http';
import Input from '@/components/elements/Input';

interface Props {
    open: boolean;
    data: AddonSettings;
    onClose: () => void;
    onSave: (data: AddonSettings) => void;
}

export default ({ open, data, onClose, onSave }: Props) => {
    const [enabled, setEnabled] = useState(data.enabled);
    const [multiplier, setMultiplier] = useState<number>((data.multiplier as number) ?? 1);
    const [saving, setSaving] = useState(false);
    const { addFlash, clearFlashes } = useFlash();

    const handleSave = async () => {
        setSaving(true);
        clearFlashes();
        try {
            const result = await updateAddon('ratelimit', { enabled, multiplier });
            onSave(result);
            onClose();
        } catch (err) {
            addFlash({ type: 'error', message: httpErrorToHuman(err) });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} title='Rate Limit'>
            <div className='flex items-center justify-between mb-4'>
                <p>Enable Rate Limit</p>
                <Switch name='enabled' checked={enabled} onChange={() => setEnabled((v) => !v)} />
            </div>
            <div className='flex items-center justify-between mb-4'>
                <p>Rate Limit Multiplier</p>
                <Input
                    type='number'
                    value={multiplier}
                    onChange={(e) => setMultiplier(parseInt(e.target.value))}
                    min={1}
                />
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
