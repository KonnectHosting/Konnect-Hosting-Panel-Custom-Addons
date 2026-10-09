import React, { useContext, useEffect, useState } from "react";
import Label from "@/components/elements/Label";
import { ServerContext } from "@/state/server";
import Input from "@/components/elements/Input";
import { Button } from "@/components/elements/button/index";
import asDialog from "@/hoc/asDialog";
import { DialogWrapperContext } from "@/components/elements/dialog/context";
import loadDirectory from "@/api/server/files/loadDirectory";
import Select from "@/components/elements/Select";
import { Dialog } from "@/components/elements/dialog";
import { addOrEditVariable } from "@/api/server/variables";
import useFlash from "@/plugins/useFlash";
import { clear } from "console";
import { add } from "date-fns";
import { useTranslation } from "react-i18next";

const EditOrAddVariable = ({ environment, variableKey, value, updateVariables }: 
    { environment?: string, variableKey?: string, value?: string, updateVariables: React.Dispatch<React.SetStateAction<Record<string, Record<string, string>>>>;
}) => {
    const { t } = useTranslation('arix/server/addons/variables');
    const { addFlash, clearFlashes } = useFlash();
    const { close } = useContext(DialogWrapperContext);
    const [files, setFiles] = useState<string[]>([]);
    const [environmentValue, setEnvironmentValue] = useState(environment || '.env');
    const [keyValue, setKeyValue] = useState(variableKey || '');
    const [valueValue, setValueValue] = useState(value || '');
    const { uuid } = ServerContext.useStoreState((state) => state.server.data!);

    useEffect(() => {
        clearFlashes('server:variables');
        loadDirectory(uuid, '/').then((files) => {
            const envFiles = files.filter((file) => file.name.startsWith('.env'));
            setFiles(envFiles.map(file => file.name));
        }).catch((error) => {
            addFlash({ type: 'error', message: `Error loading files: ${error.message}`, key: 'server:variables' });
            console.error('Error loading files:', error);
        });
    }, [uuid]);


    const handleSubmit = () => {
        addOrEditVariable(uuid, environmentValue, keyValue, valueValue).then(() => {
            updateVariables((prev) => {
                const updated = { ...prev }
                if (!updated[environmentValue]) {
                    updated[environmentValue] = {};
                }
                updated[environmentValue][keyValue] = valueValue;
                return updated;
            });
            addFlash({ type: 'success', message: `Variable ${keyValue} has been ${variableKey ? 'updated' : 'added'} successfully.`, key: 'server:variables' });
            close();
        }).catch((error) => {
            addFlash({ type: 'error', message: `Error ${variableKey ? 'updating' : 'adding'} variable: ${error.message}`, key: 'server:variables' });
            console.error('Error adding/editing variable:', error);
        });
    }

    return (
        <>
            <div className="grid lg:grid-cols-3 gap-4 mt-4">
                <div>
                    <Label htmlFor="enviroment">{t('create.environment')}</Label>
                    <Select
                        id="environment"
                        value={environmentValue}
                        onChange={(e) => setEnvironmentValue(e.target.value)}
                        disabled={!!variableKey}
                    >
                        <option value=".env">.env</option>
                        <option value=".env.development">.env.development</option>
                        <option value=".env.production">.env.production</option>
                        <option value=".env.local">.env.local</option>
                        {files.filter((file) => !['.env', '.env.development', '.env.production', '.env.local'].includes(file)).map((file) => (
                            <option key={file} value={file}>
                                {file}
                            </option>
                        ))}
                    </Select>
                </div>
                <div>
                    <Label htmlFor="key">{t('create.key')}</Label>
                    <Input
                        disabled={!!variableKey}
                        placeholder={t('create.key')}
                        id="key"
                        value={keyValue}
                        onChange={(e) => setKeyValue(e.target.value)}
                    />
                </div>
                <div>
                    <Label htmlFor="value">{t('create.value')}</Label>
                    <Input
                        placeholder={t('create.value')}
                        id="value"
                        value={valueValue}
                        onChange={(e) => setValueValue(e.target.value)}
                    />
                </div>
            </div>
            <Dialog.Footer>
                <Button.Text onClick={() => close()}>
                    {t('create.cancel')}
                </Button.Text>
                <Button onClick={handleSubmit} disabled={!keyValue || !valueValue}>
                    {variableKey ? t('create.edit') : t('create.add')}
                </Button>
            </Dialog.Footer>
        </>
    )
}

export default asDialog({
    title: "Add/Edit Variable",
    extraWidth: true
})(EditOrAddVariable);