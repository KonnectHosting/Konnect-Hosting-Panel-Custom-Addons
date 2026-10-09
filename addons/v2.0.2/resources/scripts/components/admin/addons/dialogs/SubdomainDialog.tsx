import React, { useEffect, useRef, useState } from 'react';
import { Dialog } from '@/components/elements/dialog';
import { Button } from '@/components/elements/button/index';
import Spinner from '@/components/elements/Spinner';
import Switch from '@/components/elements/Switch';
import Label from '@/components/elements/Label';
import Input from '@/components/elements/Input';
import Badge from '@/components/elements/Badge';
import NestSelector from '@/components/admin/link/NestSelector';
import { AddonSettings, updateAddon } from '@/api/admin/Addons';
import {
    BlocklistEntry,
    ConnectedDomain,
    addBlocklistEntry,
    connectDomain,
    disconnectDomain,
    exportBlocklist,
    getBlocklist,
    getCloudflareConfig,
    getConnectedDomains,
    importBlocklist,
    removeBlocklistEntry,
    setCloudflareConfig,
} from '@/api/admin/addons/Domains';
import useFlash from '@/plugins/useFlash';
import { httpErrorToHuman } from '@/api/http';
import { TrashIcon, UploadIcon, DownloadIcon } from '@heroicons/react/outline';

interface Props {
    open: boolean;
    data: AddonSettings;
    onClose: () => void;
    onSave: (data: AddonSettings) => void;
}

const statusColor = (status: ConnectedDomain['status']): 'success' | 'danger' | 'warning' => {
    if (status === 'active') return 'success';
    if (status === 'error') return 'danger';
    return 'warning';
};

export default ({ open, data, onClose, onSave }: Props) => {
    const [enabled, setEnabled] = useState(data.enabled);
    const [eggs, setEggs] = useState<number[]>(data.eggs);
    const [nests, setNests] = useState<number[]>(data.nests);
    const [saving, setSaving] = useState(false);
    const { addFlash, clearFlashes } = useFlash();

    const [loadingConfig, setLoadingConfig] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [proxyRecords, setProxyRecords] = useState(false);
    const [useAlias, setUseAlias] = useState(false);
    const [useDomainAlias, setUseDomainAlias] = useState(false);
    const [savingConfig, setSavingConfig] = useState(false);

    const [domains, setDomains] = useState<ConnectedDomain[]>([]);
    const [newDomain, setNewDomain] = useState('');
    const [connecting, setConnecting] = useState(false);
    const [disconnectingDomain, setDisconnectingDomain] = useState<string | null>(null);

    const [blocklist, setBlocklist] = useState<BlocklistEntry[]>([]);
    const [newWord, setNewWord] = useState('');
    const [newReason, setNewReason] = useState('');
    const [addingWord, setAddingWord] = useState(false);
    const [removingWordId, setRemovingWordId] = useState<number | null>(null);
    const [importing, setImporting] = useState(false);
    const importInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!open) return;

        setLoadingConfig(true);
        clearFlashes();

        Promise.all([getCloudflareConfig(), getConnectedDomains(), getBlocklist()])
            .then(([config, connectedDomains, blocklistEntries]) => {
                if (config) {
                    setApiKey(config.api_key ?? '');
                    setProxyRecords(config.proxy_records ?? false);
                    setUseAlias(config.use_alias ?? false);
                    setUseDomainAlias(config.use_domain_alias ?? false);
                }
                setDomains(Array.isArray(connectedDomains) ? connectedDomains : []);
                setBlocklist(Array.isArray(blocklistEntries) ? blocklistEntries : []);
            })
            .catch((err) => addFlash({ type: 'error', message: httpErrorToHuman(err) }))
            .finally(() => setLoadingConfig(false));
    }, [open]);

    const handleSave = async () => {
        setSaving(true);
        clearFlashes();
        try {
            const result = await updateAddon('subdomainManager', { enabled, eggs, nests });
            onSave(result);
            onClose();
        } catch (err) {
            addFlash({ type: 'error', message: httpErrorToHuman(err) });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveConfig = async () => {
        setSavingConfig(true);
        clearFlashes();
        try {
            await setCloudflareConfig({ apiKey, proxyRecords, useAlias, useDomainAlias });
            addFlash({ type: 'success', message: 'Cloudflare configuration updated.' });
        } catch (err) {
            addFlash({ type: 'error', message: httpErrorToHuman(err) });
        } finally {
            setSavingConfig(false);
        }
    };

    const handleConnectDomain = async () => {
        if (!newDomain.trim()) return;

        setConnecting(true);
        clearFlashes();
        try {
            await connectDomain(newDomain.trim());
            setNewDomain('');
            setDomains(await getConnectedDomains());
        } catch (err) {
            addFlash({ type: 'error', message: httpErrorToHuman(err) });
        } finally {
            setConnecting(false);
        }
    };

    const handleDisconnectDomain = async (domain: string) => {
        setDisconnectingDomain(domain);
        clearFlashes();
        try {
            await disconnectDomain(domain);
            setDomains((prev) => prev.filter((d) => d.domain !== domain));
        } catch (err) {
            addFlash({ type: 'error', message: httpErrorToHuman(err) });
        } finally {
            setDisconnectingDomain(null);
        }
    };

    const handleAddBlocklistEntry = async () => {
        if (!newWord.trim()) return;

        setAddingWord(true);
        clearFlashes();
        try {
            await addBlocklistEntry(newWord.trim(), newReason.trim() || undefined);
            setNewWord('');
            setNewReason('');
            setBlocklist(await getBlocklist());
        } catch (err) {
            addFlash({ type: 'error', message: httpErrorToHuman(err) });
        } finally {
            setAddingWord(false);
        }
    };

    const handleRemoveBlocklistEntry = async (id: number) => {
        setRemovingWordId(id);
        clearFlashes();
        try {
            await removeBlocklistEntry(id);
            setBlocklist((prev) => prev.filter((b) => b.id !== id));
        } catch (err) {
            addFlash({ type: 'error', message: httpErrorToHuman(err) });
        } finally {
            setRemovingWordId(null);
        }
    };

    const handleExportBlocklist = async () => {
        clearFlashes();
        try {
            const blob = await exportBlocklist();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'blocklist.json';
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            addFlash({ type: 'error', message: httpErrorToHuman(err) });
        }
    };

    const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        clearFlashes();
        try {
            await importBlocklist(file);
            setBlocklist(await getBlocklist());
            addFlash({ type: 'success', message: 'Blocklist imported successfully.' });
        } catch (err) {
            addFlash({ type: 'error', message: httpErrorToHuman(err) });
        } finally {
            setImporting(false);
            if (importInputRef.current) importInputRef.current.value = '';
        }
    };

    return (
        <Dialog open={open} onClose={onClose} title='Subdomain Manager' extraWidth>
            <div className='flex items-center justify-between mb-4'>
                <p>Enable Subdomain Manager</p>
                <Switch name='enabled' checked={enabled} onChange={() => setEnabled((v) => !v)} />
            </div>
            <NestSelector
                selectedNests={nests}
                setSelectedNests={setNests}
                selectedEggs={eggs}
                setSelectedEggs={setEggs}
            />

            {loadingConfig ? (
                <div className='flex items-center gap-x-2 py-4'>
                    <Spinner size='small' />
                    <span>Loading domain configuration...</span>
                </div>
            ) : (
                <>
                    <div className='mt-6 mb-4'>
                        <p className='font-medium text-lg text-gray-100 mb-2'>Cloudflare Configuration</p>
                        <Label htmlFor='cf_api_key'>Cloudflare API key</Label>
                        <Input
                            id='cf_api_key'
                            type='password'
                            autoComplete='off'
                            placeholder='Cloudflare API key'
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                        />
                        <p className='text-xs text-gray-400 mt-1 mb-3'>
                            The checkboxes below only affect new records; existing records keep their old settings.
                        </p>
                        <div className='flex items-center justify-between mb-2'>
                            <p>Use IPv4 alias</p>
                            <Switch
                                name='useAlias'
                                checked={useAlias}
                                readOnly={useDomainAlias}
                                onChange={() => setUseAlias((v) => !v)}
                            />
                        </div>
                        <div className='flex items-center justify-between mb-2'>
                            <p>Use domain alias</p>
                            <Switch
                                name='useDomainAlias'
                                checked={useDomainAlias}
                                readOnly={useAlias}
                                onChange={() => setUseDomainAlias((v) => !v)}
                            />
                        </div>
                        <div className='flex items-center justify-between mb-3'>
                            <p>Proxy records</p>
                            <Switch
                                name='proxyRecords'
                                checked={proxyRecords}
                                onChange={() => setProxyRecords((v) => !v)}
                            />
                        </div>
                        <Button.Text
                            onClick={handleSaveConfig}
                            disabled={savingConfig}
                            className='flex items-center gap-x-2'
                        >
                            Save Cloudflare Config
                            {savingConfig && <Spinner size='small' />}
                        </Button.Text>
                    </div>

                    <div className='mb-4'>
                        <p className='font-medium text-lg text-gray-100 mb-2'>Domains</p>
                        <div className='flex gap-x-2 mb-3'>
                            <Input
                                type='text'
                                autoComplete='off'
                                placeholder='example.com'
                                value={newDomain}
                                onChange={(e) => setNewDomain(e.target.value)}
                            />
                            <Button.Text
                                onClick={handleConnectDomain}
                                disabled={connecting || !newDomain.trim()}
                                className='flex items-center gap-x-2 whitespace-nowrap'
                            >
                                Add Domain
                                {connecting && <Spinner size='small' />}
                            </Button.Text>
                        </div>
                        <div className='border border-gray-500 rounded-box divide-y divide-gray-500 max-h-48 overflow-y-auto'>
                            {domains.length === 0 && (
                                <p className='px-3 py-2 text-sm text-gray-400'>No domains connected.</p>
                            )}
                            {domains.map((domain) => (
                                <div key={domain.domain} className='flex items-center justify-between px-3 py-2'>
                                    <div>
                                        <p className='font-medium flex items-center gap-x-2'>
                                            {domain.domain}
                                            <Badge className='text-xs' color={statusColor(domain.status)}>
                                                {domain.status}
                                            </Badge>
                                        </p>
                                        <p className='text-xs text-gray-400'>
                                            {domain.serverCount} server{domain.serverCount === 1 ? '' : 's'}
                                        </p>
                                    </div>
                                    <Button.Danger
                                        shape={Button.Shapes.IconSquare}
                                        onClick={() => handleDisconnectDomain(domain.domain)}
                                        disabled={disconnectingDomain === domain.domain}
                                    >
                                        {disconnectingDomain === domain.domain ? (
                                            <Spinner size='small' />
                                        ) : (
                                            <TrashIcon className='w-4' />
                                        )}
                                    </Button.Danger>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className='mb-4'>
                        <p className='font-medium text-lg text-gray-100 mb-2'>Domain Blocklist</p>
                        <div className='flex gap-x-2 mb-3'>
                            <Input
                                type='text'
                                autoComplete='off'
                                placeholder='Word'
                                value={newWord}
                                onChange={(e) => setNewWord(e.target.value)}
                            />
                            <Input
                                type='text'
                                autoComplete='off'
                                placeholder='Reason (optional)'
                                value={newReason}
                                onChange={(e) => setNewReason(e.target.value)}
                            />
                            <Button.Text
                                onClick={handleAddBlocklistEntry}
                                disabled={addingWord || !newWord.trim()}
                                className='flex items-center gap-x-2 whitespace-nowrap'
                            >
                                Add Word
                                {addingWord && <Spinner size='small' />}
                            </Button.Text>
                        </div>
                        <div className='border border-gray-500 rounded-box divide-y divide-gray-500 max-h-48 overflow-y-auto mb-3'>
                            {blocklist.length === 0 && (
                                <p className='px-3 py-2 text-sm text-gray-400'>No blocked words.</p>
                            )}
                            {blocklist.map((entry) => (
                                <div key={entry.id} className='flex items-center justify-between px-3 py-2'>
                                    <div>
                                        <p className='font-medium'>{entry.subdomain}</p>
                                        {entry.reason && <p className='text-xs text-gray-400'>{entry.reason}</p>}
                                    </div>
                                    <Button.Danger
                                        shape={Button.Shapes.IconSquare}
                                        size={Button.Sizes.Small}
                                        onClick={() => handleRemoveBlocklistEntry(entry.id)}
                                        disabled={removingWordId === entry.id}
                                    >
                                        {removingWordId === entry.id ? (
                                            <Spinner size='small' />
                                        ) : (
                                            <TrashIcon className='w-4' />
                                        )}
                                    </Button.Danger>
                                </div>
                            ))}
                        </div>
                        <div className='flex gap-x-2'>
                            <Button.Text
                                size={Button.Sizes.Small}
                                onClick={handleExportBlocklist}
                                className='flex items-center gap-x-2'
                            >
                                <DownloadIcon className='w-4' />
                                Export
                            </Button.Text>
                            <Button.Text
                                size={Button.Sizes.Small}
                                onClick={() => importInputRef.current?.click()}
                                disabled={importing}
                                className='flex items-center gap-x-2'
                            >
                                <UploadIcon className='w-4' />
                                Import
                                {importing && <Spinner size='small' />}
                            </Button.Text>
                            <input
                                ref={importInputRef}
                                type='file'
                                accept='application/json'
                                className='hidden'
                                onChange={handleImportFileChange}
                            />
                        </div>
                    </div>
                </>
            )}

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