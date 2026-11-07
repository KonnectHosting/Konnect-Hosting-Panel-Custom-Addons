import React, { useState } from 'react';
import { ServerContext } from '@/state/server';
import http from '@/api/http';
import { button, secondary, field } from './ToolkitPage';

async function picture(file: File): Promise<string> {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
        throw new Error('Choose a JPEG, PNG or WebP image smaller than 8 MiB.');
    }
    const url = URL.createObjectURL(file);
    try {
        const image = new Image();
        await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = () => reject(new Error('This image could not be opened.'));
            image.src = url;
        });
        if (image.naturalWidth * image.naturalHeight > 16777216)
            throw new Error('Choose an image of 16 megapixels or smaller.');
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 512;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Your browser cannot prepare this cover image.');
        const side = Math.min(image.naturalWidth, image.naturalHeight);
        context.drawImage(
            image,
            (image.naturalWidth - side) / 2,
            (image.naturalHeight - side) / 2,
            side,
            side,
            0,
            0,
            512,
            512
        );
        const encoded = canvas.toDataURL('image/jpeg', 0.88).split(',')[1];
        if (!encoded || encoded.length > 1398104) throw new Error('Choose a smaller image.');
        return encoded;
    } finally {
        URL.revokeObjectURL(url);
    }
}

export default ({
    base,
    preview,
    busy,
    run,
    refresh,
    setNotice,
}: {
    base: string;
    preview?: string;
    busy: boolean;
    run: (operation: () => Promise<void>) => Promise<void>;
    refresh: () => Promise<void>;
    setNotice: (notice: string) => void;
}) => {
    const serverName = ServerContext.useStoreState((state) => state.server.data!.name);
    const [name, setName] = useState(`${serverName} - Content`.slice(0, 80));
    const [description, setDescription] = useState('');
    const [cover, setCover] = useState<string>();
    return (
        <div className={'mt-5'}>
            <div className={'grid grid-cols-1 md:grid-cols-[180px_1fr] gap-5'}>
                <div>
                    <img
                        className={'w-40 h-40 rounded-lg object-cover border border-neutral-600'}
                        src={cover ? `data:image/jpeg;base64,${cover}` : `${base}/workshop/cover`}
                        alt={'Workshop addon cover'}
                    />
                    <label className={'block text-xs text-neutral-300 mt-3'}>
                        Choose a cover image
                        <input
                            aria-label={'Addon cover image'}
                            className={'block w-full mt-2 text-xs'}
                            type={'file'}
                            accept={'image/jpeg,image/png,image/webp'}
                            disabled={busy}
                            onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file)
                                    run(async () => {
                                        setCover(await picture(file));
                                    });
                            }}
                        />
                    </label>
                    {cover && (
                        <button className={secondary + ' text-xs'} onClick={() => setCover(undefined)} disabled={busy}>
                            Use generated cover
                        </button>
                    )}
                    <p className={'text-xs text-neutral-400 mt-2'}>
                        Center-cropped to a Steam-ready 512 × 512 JPEG. A generated cover is included by default.
                    </p>
                </div>
                <div className={'min-w-0'}>
                    <label className={'block text-sm'} htmlFor={'addon-name'}>
                        Addon name
                    </label>
                    <input
                        id={'addon-name'}
                        className={field}
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        maxLength={80}
                        placeholder={'My server content pack'}
                    />
                    <label className={'block text-sm'} htmlFor={'addon-description'}>
                        Description
                    </label>
                    <textarea
                        id={'addon-description'}
                        className={field + ' min-h-[120px]'}
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        maxLength={5000}
                        placeholder={'Describe the assets included in your content pack.'}
                    />
                    <p className={'text-xs text-neutral-400'}>
                        Only approved asset files are packaged. Addon paths are made lowercase, matching Garry&apos;s
                        Mod&apos;s publishing tool.
                    </p>
                </div>
            </div>
            <div className={'rounded border border-neutral-600 bg-neutral-900 p-3 mt-4 text-sm text-neutral-300'}>
                This creates a downloadable .gma addon with your cover and metadata. You publish it from your own Steam
                account, add it to your collection, then sync that collection on the Workshop page. The Panel does not
                sign into Steam or publish on your behalf.
            </div>
            <button
                className={button}
                disabled={busy || !preview || !name.trim()}
                onClick={() =>
                    run(async () => {
                        await http.post(`${base}/fastdl/addon`, {
                            preview,
                            name,
                            description,
                            ...(cover ? { cover } : {}),
                        });
                        setNotice(
                            'Building your Workshop addon. You can download the package when preparation finishes.'
                        );
                        await refresh();
                    })
                }
            >
                Build Workshop addon package
            </button>
            {!preview && <p className={'text-xs text-neutral-400 mt-2'}>Prepare an asset preview in step 2 first.</p>}
        </div>
    );
};
