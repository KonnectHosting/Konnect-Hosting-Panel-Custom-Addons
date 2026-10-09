import React, { useState, useContext } from 'react';
import { Form, Formik, FormikHelpers } from 'formik';
import renameFiles from '@/api/server/files/renameFiles';
import loadDirectory, { FileObject } from '@/api/server/files/loadDirectory';
import { ServerContext } from '@/state/server';
import tw from 'twin.macro';
import { Button } from '@/components/elements/button/index';
import useFileManagerSwr from '@/plugins/useFileManagerSwr';
import useFlash from '@/plugins/useFlash';
import { useTranslation } from 'react-i18next';
import { FolderIcon } from '@heroicons/react/outline';
import { ArrowCircleLeftIcon } from '@heroicons/react/solid';
import { Dialog, DialogWrapperContext } from '@/components/elements/dialog';
import asDialog from '@/hoc/asDialog';

interface FormikValues {
    name: string;
}

interface DirectoryBrowserProps {
    currentDirectory: string;
    selectedPath: string;
    onPathSelect: (path: string) => void;
}

const DirectoryBrowser: React.FC<DirectoryBrowserProps> = ({ currentDirectory, selectedPath, onPathSelect }) => {
    const { t } = useTranslation('arix/server/files');
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const [browsePath, setBrowsePath] = useState(currentDirectory);
    const [directories, setDirectories] = useState<FileObject[]>([]);
    const [loading, setLoading] = useState(false);

    React.useEffect(() => {
        const loadDirectories = async () => {
            setLoading(true);
            try {
                const files = await loadDirectory(uuid, browsePath);
                const dirs = files.filter((file) => !file.isFile);
                setDirectories(dirs);
            } catch (error) {
                console.error('Failed to load directories:', error);
                setDirectories([]);
            } finally {
                setLoading(false);
            }
        };

        loadDirectories();
    }, [uuid, browsePath]);

    const navigateToDirectory = (dirName: string) => {
        const newPath = browsePath === '/' ? `/${dirName}` : `${browsePath}/${dirName}`;
        setBrowsePath(newPath);
    };

    const navigateUp = () => {
        if (browsePath !== '/') {
            const parentPath = browsePath.split('/').slice(0, -1).join('/') || '/';
            setBrowsePath(parentPath);
        }
    };

    React.useEffect(() => {
        if (selectedPath && selectedPath !== browsePath) setBrowsePath(selectedPath);
    }, [selectedPath]);

    React.useEffect(() => {
        if (browsePath !== selectedPath) onPathSelect(browsePath);
    }, [browsePath, selectedPath, onPathSelect]);

    return (
        <div>
            <div className='bg-neutral-600 p-3 rounded'>
                New location: <span className='font-medium'>{browsePath}</span>
            </div>
            <div className='bg-neutral-600 p-2 rounded mt-3 max-h-48 overflow-y-auto'>
                {loading ? (
                    <div css={tw`text-center font-medium`}>Loading...</div>
                ) : (
                    <div>
                        {browsePath !== '/' && (
                            <div
                                className={'flex items-center gap-x-2 p-3 hover:bg-neutral-500 cursor-pointer rounded'}
                                onClick={navigateUp}
                            >
                                <ArrowCircleLeftIcon className={'w-5'} />
                                <span>Go back</span>
                            </div>
                        )}
                        {directories.map((dir) => (
                            <div
                                key={dir.key}
                                className={'flex items-center gap-x-2 p-3 hover:bg-neutral-500 cursor-pointer rounded'}
                                onClick={() => navigateToDirectory(dir.name)}
                            >
                                <FolderIcon className={'w-5 text-yellow-500'} />
                                <span>{dir.name}</span>
                            </div>
                        ))}

                        {directories.length === 0 && browsePath === '/' && (
                            <div css={tw`text-center p-3`}>No directories found.</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

const MoveFileDialog = asDialog({
    title: 'Move Files',
})(({ files, path, onRefresh }: { files: string[]; path?: string; onRefresh?: () => void }) => {
    const { t } = useTranslation('arix/server/files');
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const { mutate } = useFileManagerSwr();
    const { clearFlashes, clearAndAddHttpError } = useFlash();
    const directory = path ?? ServerContext.useStoreState((state) => state.files.directory);
    const setSelectedFiles = ServerContext.useStoreActions((actions) => actions.files.setSelectedFiles);
    const { close } = useContext(DialogWrapperContext);

    const [selectedPath, setSelectedPath] = useState(directory);

    const submit = ({ name }: FormikValues, { setSubmitting }: FormikHelpers<FormikValues>) => {
        clearFlashes('files');

        const isMovingToNewDirectory = selectedPath !== directory;
        if (files.length === 1 && isMovingToNewDirectory) {
            mutate((data) => data.filter((f) => f.name !== files[0]), false);
        }

        let data;
        if (files.length > 1) {
            data = files.map((f) => ({
                from: directory === '/' ? directory + '/' + f : '/' + directory + '/' + f,
                to: selectedPath === '/' ? f : `${selectedPath}/${f}`,
            }));
        } else {
            const fileName = files[0];
            data = [
                {
                    from: directory === '/' ? directory + '/' + fileName : '/' + directory + '/' + fileName,
                    to: selectedPath === '/' ? fileName : `${selectedPath}/${fileName}`,
                },
            ];
        }

        renameFiles(uuid, '/', data)
            .then((): Promise<any> => (files.length > 0 ? mutate() : Promise.resolve()))
            .then(() => setSelectedFiles([]))
            .catch((error) => {
                mutate();
                setSubmitting(false);
                clearAndAddHttpError({ key: 'files', error });
            })
            .then(() => {
                close();
                onRefresh?.();
            });
    };

    return (
        <Formik onSubmit={submit} initialValues={{ name: '' }}>
            {({ isSubmitting, submitForm }) => (
                <>
                    <Form css={tw`m-0`}>
                        <DirectoryBrowser
                            currentDirectory={directory}
                            selectedPath={selectedPath}
                            onPathSelect={setSelectedPath}
                        />
                    </Form>
                    <Dialog.Footer>
                        <Button.Text className={'w-full sm:w-auto'} onClick={close}>
                            {t('cancel')}
                        </Button.Text>
                        <Button className={'w-full sm:w-auto'} onClick={submitForm} disabled={isSubmitting}>
                            {t('move')}
                        </Button>
                    </Dialog.Footer>
                </>
            )}
        </Formik>
    );
});

interface MoveFileDialogProps {
    files: string[];
    onClose: () => void;
    open: boolean;
    onRefresh?: () => void;
    path?: string;
}

export default ({ files, onClose, open, onRefresh, path }: MoveFileDialogProps) => {
    return <MoveFileDialog files={files} open={open} onClose={onClose} path={path} onRefresh={onRefresh} />;
};
