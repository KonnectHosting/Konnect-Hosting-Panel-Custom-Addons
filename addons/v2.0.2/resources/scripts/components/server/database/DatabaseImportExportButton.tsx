import React, { useRef, useState } from 'react';
import { Dialog } from '@/components/elements/dialog';
import { Button } from '@/components/elements/button/index';
import Spinner from '@/components/elements/Spinner';
import Switch from '@/components/elements/Switch';
import Label from '@/components/elements/Label';
import Select from '@/components/elements/Select';
import useFlash from '@/plugins/useFlash';
import { httpErrorToHuman } from '@/api/http';
import { useTranslation } from 'react-i18next';
import { DatabaseIcon, DownloadIcon, UploadIcon } from '@heroicons/react/outline';
import { ServerContext } from '@/state/server';
import { ServerDatabase } from '@/api/server/databases/getServerDatabases';
import { exportServerDatabase, importServerDatabase } from '@/api/server/databases/databaseImportExport';

interface Props {
    databases: ServerDatabase[];
}

export default ({ databases }: Props) => {
    const { t } = useTranslation('arix/server/addons/database');
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const { addFlash, clearFlashes } = useFlash();

    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState(databases[0]?.id ?? '');
    const [wipe, setWipe] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [importing, setImporting] = useState(false);
    const importInputRef = useRef<HTMLInputElement>(null);

    const openDialog = () => {
        setSelected(databases[0]?.id ?? '');
        setWipe(false);
        clearFlashes();
        setOpen(true);
    };

    const handleExport = async () => {
        if (!selected) return;

        setExporting(true);
        clearFlashes();
        try {
            const blob = await exportServerDatabase(uuid, selected);
            const database = databases.find((d) => d.id === selected);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${database?.name ?? 'database'}-export.sql`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            addFlash({ type: 'success', message: t('export.success') });
        } catch (err) {
            addFlash({ type: 'error', message: httpErrorToHuman(err) });
        } finally {
            setExporting(false);
        }
    };

    const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selected) return;

        setImporting(true);
        clearFlashes();
        try {
            await importServerDatabase(uuid, selected, file, wipe);
            addFlash({ type: 'success', message: t('import.success') });
        } catch (err) {
            addFlash({ type: 'error', message: httpErrorToHuman(err) });
        } finally {
            setImporting(false);
            if (importInputRef.current) importInputRef.current.value = '';
        }
    };

    return (
        <>
            <Button.Text onClick={openDialog} className='flex items-center gap-x-2'>
                <DatabaseIcon className='w-4' />
                {t('import-export')}
            </Button.Text>
            <Dialog open={open} onClose={() => setOpen(false)} title={t('title')}>
                {databases.length === 0 ? (
                    <p className='text-sm text-gray-400'>{t('no-databases')}</p>
                ) : (
                    <>
                        <Label htmlFor='database_select'>{t('select-database')}</Label>
                        <Select id='database_select' value={selected} onChange={(e) => setSelected(e.target.value)}>
                            {databases.map((database) => (
                                <option key={database.id} value={database.id}>
                                    {database.name}
                                </option>
                            ))}
                        </Select>

                        <div className='flex items-center justify-between mt-6'>
                            <div>
                                <p>{t('import.wipe')}</p>
                                {wipe && <p className='text-xs text-red-400 mt-1'>{t('import.wipe-warning')}</p>}
                            </div>
                            <Switch name='wipe' checked={wipe} onChange={() => setWipe((v) => !v)} />
                        </div>

                        <input
                            ref={importInputRef}
                            type='file'
                            accept='.sql'
                            className='hidden'
                            onChange={handleImportFileChange}
                        />
                    </>
                )}

                <Dialog.Footer>
                    <Button.Text onClick={() => setOpen(false)}>{t('cancel')}</Button.Text>
                    <Button.Text
                        onClick={handleExport}
                        disabled={!selected || exporting || importing}
                        className='flex items-center gap-x-2'
                    >
                        <DownloadIcon className='w-4' />
                        {t('export.button')}
                        {exporting && <Spinner size='small' />}
                    </Button.Text>
                    <Button
                        onClick={() => importInputRef.current?.click()}
                        disabled={!selected || exporting || importing}
                        className='flex items-center gap-x-2'
                    >
                        <UploadIcon className='w-4' />
                        {t('import.button')}
                        {importing && <Spinner size='small' />}
                    </Button>
                </Dialog.Footer>
            </Dialog>
        </>
    );
};