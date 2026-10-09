import React, { useEffect, useState } from 'react';
import { ServerContext } from '@/state/server';
import { NavLink, useLocation } from 'react-router-dom';
import { encodePathSegments, hashToPath } from '@/helpers';
import tw from 'twin.macro';
import { useTranslation } from 'react-i18next';
import { ChevronRightIcon } from '@heroicons/react/outline';

interface Props {
    renderLeft?: JSX.Element;
    withinFileEditor?: boolean;
    isNewFile?: boolean;
}

export default ({ renderLeft, withinFileEditor, isNewFile }: Props) => {
    const { t } = useTranslation('arix/server/files');
    const [file, setFile] = useState<string | null>(null);
    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const directory = ServerContext.useStoreState((state) => state.files.directory);
    const { hash } = useLocation();

    useEffect(() => {
        const path = hashToPath(hash);

        if (withinFileEditor && !isNewFile) {
            const name = path.split('/').pop() || null;
            setFile(name);
        }
    }, [withinFileEditor, isNewFile, hash]);

    const breadcrumbs = (): { name: string; path?: string }[] =>
        directory
            .split('/')
            .filter((directory) => !!directory)
            .map((directory, index, dirs) => {
                if (!withinFileEditor && index === dirs.length - 1) {
                    return { name: directory };
                }

                return { name: directory, path: `/${dirs.slice(0, index + 1).join('/')}` };
            });

    return (
        <div css={tw`flex flex-shrink-0 flex-grow-0 items-center text-sm text-neutral-500 overflow-x-hidden`}>
            <span css={tw`px-1 text-neutral-300`}>{t('home')}</span>
            <ChevronRightIcon className={'w-5'} />
            <NavLink
                to={`/server/${id}/files`}
                css={tw`px-1 py-0.5 text-neutral-300 no-underline hover:bg-gray-600 rounded`}
            >
                {t('container')}
            </NavLink>
            {breadcrumbs().map((crumb, index) =>
                crumb.path ? (
                    <React.Fragment key={index}>
                        <ChevronRightIcon className={'w-5'} />
                        <NavLink
                            to={`/server/${id}/files#${encodePathSegments(crumb.path)}`}
                            css={tw`px-1 py-0.5 text-neutral-300 no-underline hover:bg-gray-600 rounded`}
                        >
                            {crumb.name}
                        </NavLink>
                    </React.Fragment>
                ) : (
                    <React.Fragment key={index}>
                        <ChevronRightIcon className={'w-5'} />
                        <span key={index} css={tw`px-1 text-neutral-100 font-medium`}>
                            {crumb.name}
                        </span>
                    </React.Fragment>
                )
            )}
            {file && (
                <React.Fragment>
                    <ChevronRightIcon className={'w-5'} />
                    <span css={tw`px-1 text-neutral-100`}>{file}</span>
                </React.Fragment>
            )}
        </div>
    );
};
