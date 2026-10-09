import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    closestCenter,
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    PointerSensor,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable } from '@dnd-kit/sortable';
import { ArrowLeftIcon } from '@heroicons/react/outline';
import Spinner from '@/components/elements/Spinner';
import FlashMessageRender from '@/components/FlashMessageRender';
import useFlash from '@/plugins/useFlash';
import { httpErrorToHuman } from '@/api/http';
import getDashboard, { updateDashboard } from '@/api/admin/Dashboard';
import { Button } from '@/components/elements/button/index';

interface Widget {
    id: string;
    label: string;
    image: string;
    size?: 'wide' | 'long';
}

const WIDGETS: Widget[] = [
    { id: 'banner', label: 'Egg Banner', image: '/arix/dashboard/banner.png', size: 'wide' },
    { id: 'statCards', label: 'Statistics cards', image: '/arix/dashboard/statCards.png', size: 'wide' },
    { id: 'infoAdvanced', label: 'Advanced information card', image: '/arix/dashboard/infoAdvanced.png' },
    { id: 'graphs', label: 'Graphs', image: '/arix/dashboard/graphs.png', size: 'wide' },
    { id: 'info', label: 'Simple information card', image: '/arix/dashboard/info.png' },
    { id: 'SFTP', label: 'SFTP Details', image: '/arix/dashboard/SFTP.png' },
    { id: 'sideGraphs', label: 'Vertical Graphs', image: '/arix/dashboard/sideGraphs.png', size: 'long' },
    { id: 'subscription', label: 'Subscription Status', image: '/arix/dashboard/subscription.png' },
];

const WIDGET_MAP = new Map(WIDGETS.map((w) => [w.id, w]));
const ALL_IDS = WIDGETS.map((w) => w.id);
const sizeClass = (size?: 'wide' | 'long') => (size === 'wide' ? 'lg:col-span-2' : size === 'long' ? 'row-span-2' : '');

const SidebarItem = ({ id }: { id: string }) => {
    const widget = WIDGET_MAP.get(id)!;
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data: { from: 'available' } });
    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            className={`rounded-component border px-3 py-2 bg-gray-800 cursor-grab active:cursor-grabbing select-none ${
                isDragging ? 'opacity-30 border-dashed border-arix/50' : 'border-gray-500'
            }`}
        >
            <img src={widget.image} alt={widget.label} className='w-full rounded pointer-events-none' />
            <span className='block font-medium text-gray-100 mt-2 text-sm'>{widget.label}</span>
        </div>
    );
};

const DropzoneItem = ({ id, onRemove }: { id: string; onRemove: (id: string) => void }) => {
    const widget = WIDGET_MAP.get(id)!;
    const { attributes, listeners, setNodeRef, isDragging } = useSortable({ id, data: { from: 'selected' } });
    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            className={`group relative rounded-component border p-2 bg-gray-800 cursor-grab active:cursor-grabbing select-none ${sizeClass(
                widget.size
            )} ${isDragging ? 'opacity-30 border-dashed border-arix/50' : 'border-gray-500'}`}
        >
            <img src={widget.image} alt={widget.label} className='w-full rounded pointer-events-none' />
            <Button.Text
                size={Button.Sizes.Small}
                className='absolute top-2 right-2 opacity-0 group-hover:opacity-100'
                onClick={(e) => {
                    e.stopPropagation();
                    onRemove(id);
                }}
            >
                Remove
            </Button.Text>
        </div>
    );
};

const Dropzone = ({ children, className }: { children: React.ReactNode; className: string }) => {
    const { setNodeRef, isOver } = useDroppable({ id: 'dropzone' });
    return (
        <div ref={setNodeRef} className={`${className} ${isOver ? 'ring-1 ring-arix/70 border-arix/70' : ''}`}>
            {children}
        </div>
    );
};

export default () => {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [available, setAvailable] = useState<string[]>(ALL_IDS);
    const [selected, setSelected] = useState<string[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const { clearFlashes, addFlash } = useFlash();
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    useEffect(() => {
        clearFlashes();
        getDashboard()
            .then((data) => {
                const valid = [...new Set(data.dashboardWidgets ?? [])].filter((id) => WIDGET_MAP.has(id));
                setSelected(valid);
                setAvailable(ALL_IDS.filter((id) => !valid.includes(id)));
            })
            .catch((error) => addFlash({ type: 'error', message: httpErrorToHuman(error) }))
            .finally(() => setLoading(false));
    }, []);

    const handleDragEnd = ({ active, over }: DragEndEvent) => {
        setActiveId(null);
        if (!over) return;

        const id = String(active.id);
        const overId = String(over.id);
        const fromSidebar = active.data.current?.from === 'available';

        if (fromSidebar) {
            if (selected.includes(id)) return;
            const insertAt = selected.indexOf(overId) >= 0 ? selected.indexOf(overId) : selected.length;
            setSelected((s) => [...s.slice(0, insertAt), id, ...s.slice(insertAt)]);
            setAvailable((a) => a.filter((x) => x !== id));
        } else {
            if (id === overId) return;
            const aIdx = selected.indexOf(id);
            const bIdx = selected.indexOf(overId);
            if (aIdx !== -1 && bIdx !== -1) setSelected((s) => arrayMove(s, aIdx, bIdx));
        }
    };

    const remove = (id: string) => {
        setSelected((s) => s.filter((x) => x !== id));
        setAvailable((a) => [...a, id]);
    };

    const activeWidget = activeId ? WIDGET_MAP.get(activeId) : null;

    return (
        <>
            <FlashMessageRender />
            {loading ? (
                <Spinner size='large' centered />
            ) : (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={({ active }: DragStartEvent) => setActiveId(String(active.id))}
                    onDragEnd={handleDragEnd}
                >
                    <div className='flex h-[calc(100dvh-57px)] p-4 gap-4'>
                        <div className={`w-96 boxBorder bg-gray-700 rounded-box overflow-y-auto flex flex-col gap-y-4`}>
                            <p className='text-lg font-medium text-gray-100 px-6 pt-5'>Dashboard</p>
                            <Link
                                to='/admin/arix/components'
                                className='mx-6 inline-flex items-center gap-x-2 text-sm text-gray-300 hover:text-gray-100 duration-300'
                            >
                                <ArrowLeftIcon className='w-4 h-4' />
                                Back to components
                            </Link>
                            <div className='px-6 flex flex-col gap-y-2'>
                                {available.map((id) => (
                                    <SidebarItem key={id} id={id} />
                                ))}
                            </div>
                            <div className='mt-auto sticky bottom-0 px-6 pb-5 bg-gray-700 z-20'>
                                <Button
                                    className='w-full relative'
                                    disabled={submitting}
                                    onClick={() => {
                                        setSubmitting(true);
                                        clearFlashes();
                                        updateDashboard({ dashboardWidgets: selected })
                                            .then((updated) => {
                                                const valid = [...new Set(updated.dashboardWidgets ?? selected)].filter(
                                                    (id) => WIDGET_MAP.has(id)
                                                );
                                                setSelected(valid);
                                                setAvailable(ALL_IDS.filter((id) => !valid.includes(id)));
                                                addFlash({
                                                    type: 'success',
                                                    message: 'Dashboard settings updated successfully.',
                                                });
                                            })
                                            .catch((error) =>
                                                addFlash({ type: 'error', message: httpErrorToHuman(error) })
                                            )
                                            .finally(() => setSubmitting(false));
                                    }}
                                >
                                    Save Changes
                                    {submitting && (
                                        <div className='absolute right-4'>
                                            <Spinner size='small' />
                                        </div>
                                    )}
                                </Button>
                            </div>
                        </div>
                        <div className='flex-1 overflow-hidden'>
                            <SortableContext items={selected}>
                                <Dropzone className='h-full overflow-y-auto border border-gray-600 rounded-component p-3 bg-gray-800/60 grid grid-cols-2 gap-3 items-start content-start'>
                                    {selected.length === 0 ? (
                                        <p className='col-span-2 text-sm text-gray-400 text-center py-8'>
                                            Drag widgets here to build your dashboard
                                        </p>
                                    ) : (
                                        selected.map((id) => <DropzoneItem key={id} id={id} onRemove={remove} />)
                                    )}
                                </Dropzone>
                            </SortableContext>
                        </div>
                    </div>
                    <DragOverlay dropAnimation={null}>
                        {activeWidget && (
                            <div
                                className={`rounded-component border border-arix/80 bg-gray-700 shadow-xl shadow-black/40 rotate-1 opacity-95 cursor-grabbing p-2 ${
                                    activeWidget.size === 'wide'
                                        ? 'w-80'
                                        : activeWidget.size === 'long'
                                        ? 'w-44'
                                        : 'w-52'
                                }`}
                            >
                                <img
                                    src={activeWidget.image}
                                    alt={activeWidget.label}
                                    className='w-full rounded pointer-events-none'
                                />
                            </div>
                        )}
                    </DragOverlay>
                </DndContext>
            )}
        </>
    );
};
