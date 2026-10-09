import React, { useEffect } from 'react';
import { httpErrorToHuman } from '@/api/http';
import Spinner from '@/components/elements/Spinner';
import { FileObject } from '@/api/server/files/loadDirectory';
import { NavLink, useLocation, useRouteMatch } from 'react-router-dom';
import { ServerError } from '@/components/elements/ScreenBlock';
import tw from 'twin.macro';
import { ServerContext } from '@/state/server';
import useFileManagerSwr from '@/plugins/useFileManagerSwr';
import { useStoreActions } from '@/state/hooks';
import { hashToPath } from '@/helpers';
import { usePermissions } from '@/plugins/usePermissions';
import { encodePathSegments } from '@/helpers';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileAlt, faFileArchive, faFileImport, faFolder } from '@fortawesome/free-solid-svg-icons';
import { join } from 'pathe';

const sortFiles = (files: FileObject[]): FileObject[] => {
    const sortedFiles: FileObject[] = files
        .sort((a, b) => a.name.localeCompare(b.name))
        .sort((a, b) => (a.isFile === b.isFile ? 0 : a.isFile ? 1 : -1));
    return sortedFiles.filter((file, index) => index === 0 || file.name !== sortedFiles[index - 1].name);
};

export default () => {
    const { hash } = useLocation();
    const { data: files, error, mutate } = useFileManagerSwr();
    const directory = ServerContext.useStoreState((state) => state.files.directory);
    const clearFlashes = useStoreActions((actions) => actions.flashes.clearFlashes);
    const setDirectory = ServerContext.useStoreActions((actions) => actions.files.setDirectory);
    const [canRead] = usePermissions(['file.read']);
    const [canReadContents] = usePermissions(['file.read-content']);
    const match = useRouteMatch();

    useEffect(() => {
        clearFlashes('files');
        setDirectory(hashToPath(hash));
    }, [hash]);

    useEffect(() => {
        mutate();
    }, [directory]);

    if (error) {
        return <ServerError message={httpErrorToHuman(error)} onRetry={() => mutate()} />;
    }

    return !files ? (
        <Spinner size={'large'} centered />
    ) : (
        <>
            {files.length && (
                <div
                    className={
                        'flex flex-col bg-gray-700 h-auto overflow-y-auto overflow-x-hidden rounded-box backdrop boxBorder w-full'
                    }
                    style={{ height: 'calc(-20rem + 100vh)' }}
                >
                    {sortFiles(files.slice(0, 250)).map((file) =>
                        (file.isFile && (!file.isEditable() || !canReadContents)) || (!file.isFile && !canRead) ? (
                            <div
                                key={file.name}
                                className={`flex items-center gap-x-2 py-3 px-4 border-t first:border-t-0 border-gray-600`}
                            >
                                {file.isFile ? (
                                    <FontAwesomeIcon
                                        icon={
                                            file.isSymlink
                                                ? faFileImport
                                                : file.isArchiveType()
                                                ? faFileArchive
                                                : faFileAlt
                                        }
                                    />
                                ) : (
                                    <FontAwesomeIcon icon={faFolder} />
                                )}
                                {file.name}
                            </div>
                        ) : (
                            <NavLink
                                className={`flex items-center gap-x-2 py-3 px-4 border-t first:border-t-0 border-gray-600`}
                                to={`${match.url.replace(/\/edit$/, '')}${
                                    file.isFile ? '/edit' : ''
                                }#${encodePathSegments(join(directory, file.name))}`}
                            >
                                {file.isFile ? (
                                    <FontAwesomeIcon
                                        icon={
                                            file.isSymlink
                                                ? faFileImport
                                                : file.isArchiveType()
                                                ? faFileArchive
                                                : faFileAlt
                                        }
                                    />
                                ) : (
                                    <FontAwesomeIcon icon={faFolder} />
                                )}
                                {file.name}
                            </NavLink>
                        )
                    )}
                </div>
            )}
        </>
    );
};
