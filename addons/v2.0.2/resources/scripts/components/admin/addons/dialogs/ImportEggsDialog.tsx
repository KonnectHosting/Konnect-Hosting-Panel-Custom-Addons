import React, { useEffect, useState } from 'react';
import { Dialog } from '@/components/elements/dialog';
import { Eggs, getEggs, importEgg } from '@/api/admin/addons/Egg';
import useFlash from '@/plugins/useFlash';
import Spinner from '@/components/elements/Spinner';
import Input from '@/components/elements/Input';
import Select from '@/components/elements/Select';
import { CheckIcon, ExternalLinkIcon } from '@heroicons/react/outline';
import Button from '@/components/elements/button/Button';
import { getNests, NestProps } from '@/api/admin/Link';
import { httpErrorToHuman } from '@/api/http';
import FlashMessageRender from '@/components/FlashMessageRender';

interface Props {
    open: boolean;
    onClose: () => void;
}

type Step = 'egg' | 'nest';

export default ({ open, onClose }: Props) => {
    const { addFlash, clearFlashes } = useFlash();
    const [step, setStep] = useState<Step>('egg');
    const [search, setSearch] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [target, setTarget] = useState<string>('game');
    const [eggs, setEggs] = useState<Eggs[]>([]);
    const [selectedEgg, setSelectedEgg] = useState<Eggs | null>(null);

    const [nests, setNests] = useState<NestProps[]>([]);
    const [nestsLoading, setNestsLoading] = useState<boolean>(false);
    const [selectedNestId, setSelectedNestId] = useState<number | null>(null);

    const [importing, setImporting] = useState<boolean>(false);

    useEffect(() => {
        if (open) {
            setStep('egg');
            setSelectedEgg(null);
            setSelectedNestId(null);
            setLoading(true);
            getEggs(target).then((eggs) => {
                setEggs(eggs);
                setSearch('');
            }).catch((error) => {
                console.error(error);
                addFlash({ key: 'admin.addons.import', type: 'error', message: 'Failed to fetch eggs.' });
            }).finally(() => {
                setLoading(false);
            });
        }
    }, [target, open]);

    useEffect(() => {
        if (open && step === 'nest' && nests.length === 0) {
            setNestsLoading(true);
            getNests().then((nests) => {
                setNests(nests);
            }).catch((error) => {
                console.error(error);
                addFlash({ key: 'admin.addons.import', type: 'error', message: 'Failed to fetch nests.' });
            }).finally(() => {
                setNestsLoading(false);
            });
        }
    }, [open, step]);

    const EggName = (egg: string) => {
        return egg.replace('egg-', '').split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }

    const handleImport = () => {
        if (!selectedEgg || !selectedNestId) {
            return;
        }

        clearFlashes();
        setImporting(true);
        importEgg(selectedEgg, selectedNestId).then(() => {
            addFlash({ key: 'admin.addons.import',type: 'success', message: `${EggName(selectedEgg.name)} was successfully imported.` });
            onClose();
        }).catch((error) => {
            console.error(error);
            addFlash({ key: 'admin.addons.import', type: 'error', message: httpErrorToHuman(error) });
        }).finally(() => {
            setImporting(false);
        });
    };

    return (
        <>
        <FlashMessageRender byKey={'admin.addons.import'} />
        <Dialog open={open} onClose={onClose} title='Egg Importer' extraWidth>
            {step === 'egg' ? (
                <>
                    <div className='flex mb-4 gap-4'>
                        <Input
                            type='text'
                            placeholder='Search for an egg...'
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <Select
                            value={target}
                            onChange={(e) => setTarget(e.target.value)}
                        >
                            <option value='game'>Game</option>
                            <option value='application'>Application</option>
                            <option value='generic'>Generic</option>
                        </Select>
                    </div>
                    {loading ? (
                        <Spinner size='large' centered />
                    ) : (
                        <div className='grid lg:grid-cols-3 gap-4'>
                            {eggs.filter((egg) => egg.name.includes(search)).map((egg) => (
                                <div
                                    key={egg.name}
                                    onClick={() => setSelectedEgg(egg)}
                                    className={`p-4 border rounded-box flex flex-col cursor-pointer duration-300 ${
                                        selectedEgg?.name === egg.name
                                            ? 'border-arix bg-arix/10'
                                            : 'border-gray-600 hover:bg-gray-700'
                                    }`}
                                >
                                    <div className='flex items-center gap-x-2'>
                                        <h3 className='font-medium'>{EggName(egg.name)}</h3>
                                        <a
                                            href={egg.information}
                                            target='_blank'
                                            rel='noopener noreferrer'
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <ExternalLinkIcon className={'w-5'} />
                                        </a>
                                        <CheckIcon
                                            className={`w-5 ml-auto ${
                                                selectedEgg?.name === egg.name ? 'text-arix' : 'opacity-0'
                                            }`}
                                        />
                                    </div>
                                    {egg.parent_groups && egg.parent_groups.length > 0 && (
                                        <div className='flex items-center gap-x-2 pt-1 mt-auto'>
                                            {egg.parent_groups.map((group) => (
                                                <span key={group} className='px-2 py-1 bg-gray-600 rounded text-xs'>
                                                    {EggName(group.replace('_', ' '))}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </>
            ) : (
                <div>
                    <p className='mb-4 text-sm text-gray-300'>
                        Select the nest that <strong>{selectedEgg ? EggName(selectedEgg.name) : ''}</strong> should
                        be imported into.
                    </p>
                    {nestsLoading ? (
                        <Spinner size='large' centered />
                    ) : (
                        <div className='grid lg:grid-cols-3 gap-4'>
                            {nests.map((nest) => (
                                <div
                                    key={nest.attributes.id}
                                    onClick={() => setSelectedNestId(nest.attributes.id)}
                                    className={`p-4 border rounded-box flex items-center justify-between cursor-pointer duration-300 ${
                                        selectedNestId === nest.attributes.id
                                            ? 'border-arix bg-arix/10'
                                            : 'border-gray-600 hover:bg-gray-700'
                                    }`}
                                >
                                    <span className='font-medium'>{nest.attributes.name}</span>
                                    <CheckIcon
                                        className={`w-5 ${
                                            selectedNestId === nest.attributes.id ? 'text-arix' : 'opacity-0'
                                        }`}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <Dialog.Footer>
                {step === 'egg' ? (
                    <>
                        <Button.Text onClick={onClose}>Close</Button.Text>
                        <Button disabled={!selectedEgg} onClick={() => setStep('nest')}>
                            Import
                        </Button>
                    </>
                ) : (
                    <>
                        <Button.Text onClick={() => setStep('egg')} disabled={importing}>
                            Back
                        </Button.Text>
                        <Button
                            disabled={!selectedNestId || importing}
                            onClick={handleImport}
                            className='flex items-center gap-x-2'
                        >
                            Import
                            {importing && <Spinner size='small' />}
                        </Button>
                    </>
                )}
            </Dialog.Footer>
        </Dialog>
        </>
    );
};
