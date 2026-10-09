import { EggProps, getEggs, getNests, NestProps } from '@/api/admin/Link';
import Input from '@/components/elements/Input';
import Label from '@/components/elements/Label';
import Spinner from '@/components/elements/Spinner';
import { CheckIcon } from '@heroicons/react/outline';
import React, { useState, useEffect } from 'react';

type NestSelectorProps = {
    selectedNests: number[];
    setSelectedNests: (nests: number[]) => void;
    selectedEggs: number[];
    setSelectedEggs: (eggs: number[]) => void;
};

export default ({ selectedNests, setSelectedNests, selectedEggs, setSelectedEggs }: NestSelectorProps) => {
    const [nests, setNests] = useState<NestProps[]>([]);
    const [eggsByNest, setEggsByNest] = useState<Record<number, EggProps[]>>({});
    const [showSelected, setShowSelected] = useState(false);
    const [search, setSearch] = useState('');

    useEffect(() => {
        const fetchNests = async () => {
            try {
                const result = await getNests();
                setNests(result);

                const eggsResults = await Promise.all(
                    result.map(async (nest) => {
                        const nestId = nest.attributes.id;
                        const eggs = await getEggs(nestId);

                        return [nestId, eggs] as const;
                    })
                );

                setEggsByNest(Object.fromEntries(eggsResults));
            } catch (error) {
                console.error('Error fetching nests:', error);
            }
        };

        fetchNests();
    }, []);

    const toggleNest = (nestId: number) => {
        if (selectedNests.includes(nestId)) {
            setSelectedNests(selectedNests.filter((id) => id !== nestId));
            return;
        }

        setSelectedNests([...selectedNests, nestId]);
    };

    const toggleEgg = (eggId: number) => {
        if (selectedEggs.includes(eggId)) {
            setSelectedEggs(selectedEggs.filter((id) => id !== eggId));
            return;
        }

        setSelectedEggs([...selectedEggs, eggId]);
    };

    const normalizedSearch = search.trim().toLowerCase();

    const filteredNests = nests.filter((nest) => {
        const nestId = nest.attributes.id;
        const nestName = nest.attributes.name.toLowerCase();
        const eggs = eggsByNest[nestId] ?? [];

        const matchesSearch =
            normalizedSearch.length === 0 ||
            nestName.includes(normalizedSearch) ||
            String(nestId).includes(normalizedSearch) ||
            eggs.some(
                (egg) =>
                    egg.attributes.name.toLowerCase().includes(normalizedSearch) ||
                    String(egg.attributes.id).includes(normalizedSearch)
            );

        if (!matchesSearch) {
            return false;
        }

        if (!showSelected) {
            return true;
        }

        const hasSelectedNest = selectedNests.includes(nestId);
        const hasSelectedEgg = eggs.some((egg) => selectedEggs.includes(egg.attributes.id));

        return hasSelectedNest || hasSelectedEgg;
    });

    return (
        <div>
            {nests.length > 0 ? (
                <div className='bg-gray-700 border border-gray-500 rounded-component'>
                    <div className='px-4 pt-4'>
                        <div className='flex justify-between items-start'>
                            <Label className='mb-2' htmlFor='nestSearch'>
                                Nests & Eggs
                            </Label>
                            <div className='flex gap-x-1 text-xs'>
                                <button
                                    onClick={() => setShowSelected(false)}
                                    className={`duration-300 ${!showSelected ? 'underline' : ''}`}
                                >
                                    Show All
                                </button>
                                /
                                <button
                                    onClick={() => setShowSelected(true)}
                                    className={`duration-300 ${showSelected ? 'underline' : ''}`}
                                >
                                    Selected ({selectedNests.length + selectedEggs.length})
                                </button>
                            </div>
                        </div>
                        <Input
                            name='nestSearch'
                            placeholder='Search nests or eggs...'
                            className='!py-2 px-3 mb-2'
                            value={search}
                            onChange={(e) => setSearch(e.currentTarget.value)}
                        />
                    </div>
                    <div className='space-y-1 max-h-56 overflow-y-auto px-4 pb-4'>
                        {filteredNests.map((nest) => {
                            const nestId = nest.attributes.id;
                            const nestSelected = selectedNests.includes(nestId);
                            const eggs = eggsByNest[nestId] ?? [];
                            const visibleEggs = eggs.filter((egg) => {
                                const matchesSearch =
                                    normalizedSearch.length === 0 ||
                                    egg.attributes.name.toLowerCase().includes(normalizedSearch) ||
                                    String(egg.attributes.id).includes(normalizedSearch);

                                if (!matchesSearch) {
                                    return false;
                                }

                                if (!showSelected) {
                                    return true;
                                }

                                return selectedEggs.includes(egg.attributes.id);
                            });

                            return (
                                <React.Fragment key={nestId}>
                                    {(!showSelected || nestSelected) && (
                                        <div
                                            onClick={() => toggleNest(nestId)}
                                            className={`flex items-center justify-between py-1 px-2 rounded-component duration-300 cursor-pointer ${
                                                nestSelected ? 'bg-arix/20' : 'hover:bg-gray-600'
                                            }`}
                                        >
                                            <span className='text-sm'>{nest.attributes.name}</span>
                                            <CheckIcon className={`w-4 ${nestSelected ? 'text-arix' : 'opacity-0'}`} />
                                        </div>
                                    )}
                                    {visibleEggs.length > 0 && (
                                        <div className='ml-2 space-y-1'>
                                            {visibleEggs.map((egg) => {
                                                const eggId = egg.attributes.id;
                                                const eggSelected = selectedEggs.includes(eggId);

                                                return (
                                                    <div
                                                        key={eggId}
                                                        onClick={() => toggleEgg(eggId)}
                                                        className={`flex items-center justify-between py-1 px-2 rounded-component duration-300 cursor-pointer ${
                                                            eggSelected ? 'bg-arix/20' : 'hover:bg-gray-600'
                                                        }`}
                                                    >
                                                        <span className='text-sm'>{egg.attributes.name}</span>
                                                        <CheckIcon
                                                            className={`w-4 ${eggSelected ? 'text-arix' : 'opacity-0'}`}
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className='flex items-center gap-x-1'>
                    <Spinner size='small' />
                    Loading nests and eggs
                </div>
            )}
        </div>
    );
};
