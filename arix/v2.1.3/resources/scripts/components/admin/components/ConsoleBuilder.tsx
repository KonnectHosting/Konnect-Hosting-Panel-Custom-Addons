import DropdownMenu, { DropdownButtonRow } from '@/components/elements/DropdownMenu';
import { PlusIcon, TerminalIcon, XIcon } from '@heroicons/react/outline';
import React from 'react';
import { useField } from 'formik';
import { Button } from '../../elements/button/index';

const StatCard = ({ remove }: { remove: () => void }) => (
    <div className='relative group border border-transparent duration-300 hover:border-arix rounded-lg'>
        <Button.Danger
            type='button'
            shape={Button.Shapes.IconSquare}
            size={Button.Sizes.Small}
            onClick={remove}
            className='absolute -top-1 right-1 duration-300 opacity-0 group-hover:opacity-100'
        >
            <XIcon className='w-5' />
        </Button.Danger>
        <div className='grid grid-cols-3 gap-2'>
            <div className='border border-gray-500 bg-gray-600 rounded-component p-4'>
                <div className='h-4 w-2/3 bg-white/50 rounded-sm' />
            </div>
            <div className='border border-gray-500 bg-gray-600 rounded-component p-4'>
                <div className='h-4 w-2/3 bg-white/50 rounded-sm' />
            </div>
            <div className='border border-gray-500 bg-gray-600 rounded-component p-4'>
                <div className='h-4 w-2/3 bg-white/50 rounded-sm' />
            </div>
        </div>
    </div>
);

const Graphs = ({ remove }: { remove: () => void }) => (
    <div className='relative group border border-transparent duration-300 hover:border-arix rounded-lg'>
        <Button.Danger
            type='button'
            shape={Button.Shapes.IconSquare}
            size={Button.Sizes.Small}
            onClick={remove}
            className='absolute -top-1 right-1 duration-300 opacity-0 group-hover:opacity-100'
        >
            <XIcon className='w-5' />
        </Button.Danger>
        <div className='grid grid-cols-3 gap-2'>
            <div className='border border-gray-500 bg-gray-600 rounded-component'>
                <div className='h-4 w-2/3 bg-white/50 rounded-sm m-4' />
                <div className='h-8 border-t border-arix bg-arix/50' />
            </div>
            <div className='border border-gray-500 bg-gray-600 rounded-component'>
                <div className='h-4 w-2/3 bg-white/50 rounded-sm m-4' />
                <div className='h-8 border-t border-arix bg-arix/50' />
            </div>
            <div className='border border-gray-500 bg-gray-600 rounded-component'>
                <div className='h-4 w-2/3 bg-white/50 rounded-sm m-4' />
                <div className='h-8 border-t border-arix bg-arix/50' />
            </div>
        </div>
    </div>
);

const SideGraph = ({ remove }: { remove: () => void }) => (
    <div className='relative group w-1/4 flex flex-col gap-2 border border-transparent duration-300 hover:border-arix rounded-lg'>
        <Button.Danger
            type='button'
            shape={Button.Shapes.IconSquare}
            size={Button.Sizes.Small}
            onClick={remove}
            className='absolute -top-1 right-1 duration-300 opacity-0 group-hover:opacity-100'
        >
            <XIcon className='w-5' />
        </Button.Danger>
        <div className='h-full border border-gray-500 bg-gray-600 rounded-component overflow-hidden'>
            <div className='h-4 w-2/3 bg-white/50 rounded-sm m-4' />
            <div className='h-full border-t border-arix bg-arix/50' />
        </div>
        <div className='h-full border border-gray-500 bg-gray-600 rounded-component overflow-hidden'>
            <div className='h-4 w-2/3 bg-white/50 rounded-sm m-4' />
            <div className='h-full border-t border-arix bg-arix/50' />
        </div>
    </div>
);

export default () => {
    const [statCardsField, , statCardsHelpers] = useField<number>('statsCards');
    const [graphsField, , graphsHelpers] = useField<number>('graphs');
    const [sideGraphsField, , sideGraphsHelpers] = useField<number>('sideGraphs');

    const statCards = statCardsField.value ?? 1;
    const graphs = graphsField.value ?? 1;
    const sideGraphs = sideGraphsField.value ?? 1;

    const setStatCards = (value: number) => statCardsHelpers.setValue(value);
    const setGraphs = (value: number) => graphsHelpers.setValue(value);
    const setSideGraphs = (value: number) => sideGraphsHelpers.setValue(value);

    return (
        <div className='w-full border border-gray-500 rounded-component flex flex-col gap-2 p-4'>
            {statCards === 2 && <StatCard remove={() => setStatCards(1)} />}
            {(statCards !== 2 || graphs !== 2) && (
                <DropdownMenu
                    renderToggle={(onClick) => (
                        <button
                            className='cursor-pointer w-full hover:border-arix border border-gray-500 border-dashed py-2 flex items-center justify-center rounded-component'
                            type='button'
                            onClick={onClick}
                        >
                            <PlusIcon className='w-4' />
                            <span className='text-sm'>Add Component</span>
                        </button>
                    )}
                >
                    {statCards !== 2 && (
                        <DropdownButtonRow onClick={() => setStatCards(2)}>Statistics cards</DropdownButtonRow>
                    )}
                    {graphs !== 2 && <DropdownButtonRow onClick={() => setGraphs(2)}>Chart cards</DropdownButtonRow>}
                </DropdownMenu>
            )}
            {graphs === 2 && <Graphs remove={() => setGraphs(1)} />}
            <div className='flex gap-x-2'>
                {sideGraphs !== 3 && (
                    <button
                        className='cursor-pointer w-10 hover:border-arix border border-gray-500 border-dashed py-2 flex items-center justify-center rounded-component'
                        type='button'
                        onClick={() => setSideGraphs(3)}
                    >
                        <PlusIcon className='w-4' />
                    </button>
                )}
                {sideGraphs === 3 && <SideGraph remove={() => setSideGraphs(1)} />}
                <div className='h-52 flex-1 border border-gray-500 bg-gray-600 rounded-component flex items-center justify-center flex-col'>
                    <TerminalIcon className='w-10 mt-auto' />
                    <div className='w-full mt-auto p-2'>
                        <div className='h-6 bg-gray-500 rounded' />
                    </div>
                </div>
                {sideGraphs !== 2 && (
                    <button
                        className='cursor-pointer w-10 hover:border-arix border border-gray-500 border-dashed py-2 flex items-center justify-center rounded-component'
                        type='button'
                        onClick={() => setSideGraphs(2)}
                    >
                        <PlusIcon className='w-4' />
                    </button>
                )}
                {sideGraphs === 2 && <SideGraph remove={() => setSideGraphs(1)} />}
            </div>
            {statCards === 3 && <StatCard remove={() => setStatCards(1)} />}
            {(statCards !== 3 || graphs !== 3) && (
                <DropdownMenu
                    renderToggle={(onClick) => (
                        <button
                            className='cursor-pointer w-full border border-gray-500 border-dashed py-2 flex items-center justify-center rounded-component'
                            type='button'
                            onClick={onClick}
                        >
                            <PlusIcon className='w-4' />
                            <span className='text-sm'>Add Component</span>
                        </button>
                    )}
                >
                    {statCards !== 3 && (
                        <DropdownButtonRow onClick={() => setStatCards(3)}>Statistics cards</DropdownButtonRow>
                    )}
                    {graphs !== 3 && <DropdownButtonRow onClick={() => setGraphs(3)}>Chart cards</DropdownButtonRow>}
                </DropdownMenu>
            )}
            {graphs === 3 && <Graphs remove={() => setGraphs(1)} />}
        </div>
    );
};
