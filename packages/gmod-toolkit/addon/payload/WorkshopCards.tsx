import React from 'react';
import { formatBytes } from './ToolkitPage';

export interface WorkshopItem {
    id: string;
    title: string;
    description?: string;
    image?: string | null;
    bytes?: number | null;
    updated?: number;
    subscribers?: number | null;
}
export interface WorkshopCollection {
    collection?: string;
    title?: string;
    bytes?: number;
    knownSizes?: number;
    collections: number;
    duplicates: number;
    items: WorkshopItem[];
}

const age = (timestamp: number) => {
    const days = Math.max(0, Math.floor((Date.now() / 1000 - timestamp) / 86400));
    if (days === 0) return 'today';
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
    const years = Math.floor(months / 12);
    return `${years} year${years === 1 ? '' : 's'} ago`;
};

export default ({ collection, fallback }: { collection: WorkshopCollection; fallback: string }) => (
    <section className={'mt-8'} aria-label={'Collection items'}>
        <div className={'flex flex-wrap items-end justify-between gap-3 mb-4'}>
            <div>
                <h2 className={'text-xl font-semibold'}>
                    Collection items{collection.knownSizes ? ` (${formatBytes(collection.bytes)})` : ''}
                </h2>
                <p className={'text-sm text-neutral-300 mt-1'}>
                    {collection.items.length} addons for players to download. {collection.duplicates} duplicate
                    references removed.
                </p>
            </div>
            {collection.collection && (
                <a
                    className={'text-blue-400 text-sm hover:underline'}
                    href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${collection.collection}`}
                    target={'_blank'}
                    rel={'noopener noreferrer'}
                >
                    Open collection on Steam ↗
                </a>
            )}
        </div>
        <div className={'grid grid-cols-1 min-[360px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 gap-4'}>
            {collection.items.map((item) => (
                <article
                    key={item.id}
                    className={
                        'min-w-0 rounded-lg overflow-hidden border border-neutral-600 bg-neutral-700 flex flex-col'
                    }
                >
                    <a
                        className={'relative block aspect-[4/3] bg-neutral-800 overflow-hidden'}
                        href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${item.id}`}
                        target={'_blank'}
                        rel={'noopener noreferrer'}
                        aria-label={`View ${item.title} on Steam Workshop`}
                    >
                        <img
                            className={'w-full h-full object-cover'}
                            src={item.image || fallback}
                            alt={item.title}
                            loading={'lazy'}
                            referrerPolicy={'no-referrer'}
                            onError={(event) => {
                                const image = event.currentTarget;
                                if (!image.dataset.fallback) {
                                    image.dataset.fallback = 'true';
                                    image.src = fallback;
                                }
                            }}
                        />
                        <span
                            className={
                                'absolute top-2 right-2 px-2 py-1 rounded bg-black bg-opacity-75 text-white text-xs'
                            }
                        >
                            {formatBytes(item.bytes)}
                        </span>
                        {item.subscribers !== null && item.subscribers !== undefined && (
                            <span
                                className={
                                    'absolute bottom-2 left-2 px-2 py-1 rounded bg-black bg-opacity-75 text-white text-xs'
                                }
                            >
                                ↓ {item.subscribers.toLocaleString()}
                            </span>
                        )}
                    </a>
                    <div className={'p-3 flex flex-col flex-1 min-w-0'}>
                        <h3
                            className={'font-semibold text-neutral-100 text-sm leading-5 line-clamp-2'}
                            title={item.title}
                        >
                            {item.title}
                        </h3>
                        <p className={'text-xs text-neutral-300 leading-5 mt-2 line-clamp-3'}>
                            {item.description || 'No description provided by the author.'}
                        </p>
                        <div
                            className={
                                'flex flex-wrap gap-2 justify-between items-end mt-auto pt-4 text-xs text-neutral-300'
                            }
                        >
                            <span title={item.updated ? new Date(item.updated * 1000).toLocaleString() : undefined}>
                                {item.updated ? `Updated ${age(item.updated)}` : 'Update date unavailable'}
                            </span>
                            <a
                                className={'text-blue-300 hover:underline'}
                                href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${item.id}`}
                                target={'_blank'}
                                rel={'noopener noreferrer'}
                            >
                                View Workshop ↗
                            </a>
                        </div>
                    </div>
                </article>
            ))}
        </div>
    </section>
);
