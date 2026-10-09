import React, { useState } from 'react';
import { Dialog } from '@/components/elements/dialog';
import { Button } from '@/components/elements/button/index';
import Spinner from '@/components/elements/Spinner';
import Switch from '@/components/elements/Switch';
import NestSelector from '@/components/admin/link/NestSelector';
import { AddonSettings, updateAddon } from '@/api/admin/Addons';
import useFlash from '@/plugins/useFlash';
import { httpErrorToHuman } from '@/api/http';

interface Props {
    open: boolean;
    data: {
        txAdminLogin: boolean;
        txAdminSetup: boolean;
        cacheDelete: boolean;
    } & AddonSettings;
    onClose: () => void;
    onSave: (data: AddonSettings) => void;
}

export default ({ open, data, onClose, onSave }: Props) => {
    const [enabled, setEnabled] = useState(data.enabled);
    const [eggs, setEggs] = useState<number[]>(data.eggs);
    const [nests, setNests] = useState<number[]>(data.nests);
    const [saving, setSaving] = useState(false);
    const { addFlash, clearFlashes } = useFlash();

    const [txAdminLogin, setTxAdminLogin] = useState(data.txAdminLogin);
    const [txAdminSetup, setTxAdminSetup] = useState(data.txAdminSetup);
    const [cacheDelete, setCacheDelete] = useState(data.cacheDelete);

    const handleSave = async () => {
        setSaving(true);
        clearFlashes();
        try {
            const result = await updateAddon('fivemUtils', 
                { enabled, eggs, nests, txAdminLogin, txAdminSetup, cacheDelete });
            onSave(result);
            onClose();
        } catch (err) {
            addFlash({ type: 'error', message: httpErrorToHuman(err) });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} title='Fivem Utils'>
            <div className='flex items-center justify-between mb-4'>
                <p>Enable Fivem Utils</p>
                <Switch name='enabled' checked={enabled} onChange={() => setEnabled((v) => !v)} />
            </div>
            <div className='mb-4'>
                <p className='font-medium text-lg text-gray-100 mb-2'>Toggle Fivem Utils</p>
                <div className='flex items-center justify-between mb-2'>
                    <p>TxAdmin AutoLogin</p>
                    <Switch name='txAdminLogin' checked={txAdminLogin} onChange={() => setTxAdminLogin((v) => !v)} />
                </div>
                <div className='flex items-center justify-between mb-2'>
                    <p>TxAdmin Setup</p>
                    <Switch name='txAdminSetup' checked={txAdminSetup} onChange={() => setTxAdminSetup((v) => !v)} />
                </div>
                <div className='flex items-center justify-between mb-2'>
                    <p>Cache Delete</p>
                    <Switch name='cacheDelete' checked={cacheDelete} onChange={() => setCacheDelete((v) => !v)} />
                </div>
            </div>
            <NestSelector
                selectedNests={nests}
                setSelectedNests={setNests}
                selectedEggs={eggs}
                setSelectedEggs={setEggs}
            />
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
