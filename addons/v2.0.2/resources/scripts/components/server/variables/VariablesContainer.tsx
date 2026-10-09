import React, { useEffect, useState } from "react";
import ServerContentBlock from "@/components/elements/ServerContentBlock";
import { DocumentTextIcon, ExternalLinkIcon } from "@heroicons/react/outline";
import loadDirectory from "@/api/server/files/loadDirectory";
import { ServerContext } from "@/state/server";
import getFileContents from "@/api/server/files/getFileContents";
import ItemList, { ItemCell, ItemRow } from "@/components/elements/ItemList";
import { Link } from "react-router-dom";
import { Button } from "@/components/elements/button/index";
import EditOrAddVariable from "./EditOrAddVariable";
import Spinner from "@/components/elements/Spinner";
import VariableMassActions from "./VariableMassAction";
import { createVariablesBackup } from "@/api/server/variables";
import useFlash from "@/plugins/useFlash";
import { useTranslation } from "react-i18next";

export default function () {
    const { t } = useTranslation('arix/server/addons/variables');
    const { addFlash, clearFlashes } = useFlash();
    const [isLoading, setIsLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [variables, setVariables] = useState<Record<string, Record<string, string>>>({});
    const { uuid, id } = ServerContext.useStoreState((state) => state.server.data!);

    useEffect(() => {
        clearFlashes('server:variables');
        loadDirectory(uuid, '/').then((files) => {
            const envFiles = files.filter((file) => file.name.startsWith('.env'));
            
            envFiles.forEach((file) => {
                getFileContents(uuid, file.name).then((contents) => {
                    const lines = contents.split('\n');
                    const fileVariables: Record<string, string> = {};
                    lines.forEach((line) => {
                        const [key, value] = line.split('=');
                        if (key && value) {
                            fileVariables[key.trim()] = value.trim();
                        }
                    });
                    setVariables((prev) => ({ ...prev, [file.name]: fileVariables }));
                }).catch((error) => {
                    addFlash({ type: 'error', message: `Error loading contents of ${file.name}: ${error.message}`, key: 'server:variables' });
                    console.error(`Error loading contents of ${file.name}:`, error);
                });
            });
        }).catch((error) => {
            addFlash({ type: 'error', message: `Error loading files: ${error.message}`, key: 'server:variables' });
            console.error('Error loading files:', error);
        }).finally(() => {
            setIsLoading(false);
        });
    }, [uuid]);

    const createBackup = () => {
        createVariablesBackup(uuid, `Variables Backup (${new Date().toISOString()})`)
            .then((backup) => {
                addFlash({ type: 'success', message: `${t('backup_create')} ${backup.name}`, key: 'server:variables' });
            }).catch((error) => {
                addFlash({ type: 'error', message: `Error creating backup: ${error.message}`, key: 'server:variables' });
                console.error('Error creating backup:', error);
            });
    };

    return (
        <ServerContentBlock
            title={t('variables')}
            icon={DocumentTextIcon}
            showFlashKey="server:variables"
        >
            <EditOrAddVariable
                open={isOpen}
                onClose={() => setIsOpen(false)}
                updateVariables={setVariables}
            />
            <ItemList
                title={
                    <div className={'flex lg:flex-row flex-col gap-2 items-start justify-between'}>
                        <div>
                            <p className={'text-medium text-gray-300'}>{t('variables')}</p>
                        </div>
                        <div className="flex items-center gap-x-2">
                            <Button.Text onClick={createBackup}>
                                {t('create_backup')}
                            </Button.Text>
                            <Button
                                onClick={() => setIsOpen(true)}
                            >
                                {t('add_variable')}
                            </Button>
                        </div>
                    </div>
                }
                    headers={
                        <tr>
                            <th>{t('key')}</th>
                            <th>{t('value')}</th>
                            <th></th>
                        </tr>
                    }
            >
                {isLoading ? (
                    <ItemRow>
                        <ItemCell colSpan={3}>
                            <Spinner centered/>
                        </ItemCell>
                    </ItemRow>
                ) : (
                    Object.keys(variables).length === 0 ? (
                        <ItemRow>
                            <ItemCell colSpan={3}>
                                <p className={'text-gray-300 text-sm text-center'}>{t('no_variables_found')}</p>
                            </ItemCell>
                        </ItemRow>
                    ) : (
                        Object.entries(variables).sort(([a], [b]) => a.localeCompare(b)).map(([fileName, fileVariables]) => (
                            <React.Fragment key={fileName}>
                                <ItemRow>
                                    <ItemCell colSpan={2} className="!py-2 bg-gray-500">
                                        {fileName}
                                    </ItemCell>
                                    <ItemCell className="!py-2 bg-gray-500">
                                        <div className="flex justify-end">
                                            <Link to={`/server/${id}/files/edit#/${fileName}`}>
                                                <ExternalLinkIcon className={'w-5'} />
                                            </Link>
                                        </div>
                                    </ItemCell>
                                </ItemRow>
                                {Object.keys(fileVariables).length === 0 ? (
                                    <ItemRow>
                                        <ItemCell colSpan={3}>
                                            <p className={'text-gray-300 text-sm text-center'}>{t('no_variables_found_in_file')}</p>
                                        </ItemCell>
                                    </ItemRow>
                                ) : (
                                    Object.entries(fileVariables).map(([key, value]) => (
                                        <ItemRow key={`${fileName}-${key}`}>
                                            <ItemCell>{key}</ItemCell>
                                            <ItemCell>{value}</ItemCell>
                                            <ItemCell className={'w-1'}>
                                                <VariableMassActions
                                                    variable={{ environment: fileName, key, value }}
                                                    updateVariables={setVariables}
                                                />
                                            </ItemCell>
                                        </ItemRow>
                                    )
                                ))}
                            </React.Fragment>
                        ))
                    )
                )}
            </ItemList>
        </ServerContentBlock>
    )
}