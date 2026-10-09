import React, { useContext, useEffect, useState } from "react";
import Label from "@/components/elements/Label";
import { ServerContext } from "@/state/server";
import { Button } from "@/components/elements/button/index";
import asDialog from "@/hoc/asDialog";
import { DialogWrapperContext } from "@/components/elements/dialog/context";
import loadDirectory from "@/api/server/files/loadDirectory";
import Select from "@/components/elements/Select";
import { Dialog } from "@/components/elements/dialog";
import { moveVariable } from "@/api/server/variables";
import useFlash from "@/plugins/useFlash";
import { useTranslation } from "react-i18next";

const MoveVariableDialog = ({ environment, variableKey, value, updateVariables }:
    { environment: string, variableKey: string, value: string, updateVariables: React.Dispatch<React.SetStateAction<Record<string, Record<string, string>>>>;
}) => {
    const { t } = useTranslation('arix/server/addons/variables');
    const { addFlash } = useFlash();
    const { close } = useContext(DialogWrapperContext);
    const [files, setFiles] = useState<string[]>([]);
    const [targetEnvironment, setTargetEnvironment] = useState(environment);
    const { uuid } = ServerContext.useStoreState((state) => state.server.data!);

    useEffect(() => {
        loadDirectory(uuid, '/').then((files) => {
            const envFiles = files.filter((file) => file.name.startsWith('.env'));
            setFiles(envFiles.map(file => file.name));
        }).catch((error) => {
            console.error('Error loading files:', error);
            addFlash({ type: 'error', message: `Error loading files: ${error.message}`, key: 'server:variables' })
        });
    }, [uuid]);

    const handleSubmit = () => {
        moveVariable(uuid, environment, targetEnvironment, variableKey).then(() => {
            updateVariables((prev) => {
                const updated = { ...prev };
                if (updated[environment]) {
                    delete updated[environment][variableKey];
                }
                if (!updated[targetEnvironment]) {
                    updated[targetEnvironment] = {};
                }
                updated[targetEnvironment][variableKey] = value;
                return updated;
            });
            addFlash({ type: 'success', message: t('moveDialog.success', { variable: variableKey, environment: environment, targetEnvironment: targetEnvironment }), key: 'server:variables' });
            close();
        }).catch((error) => {
            addFlash({ type: 'error', message: `Error moving variable: ${error.message}`, key: 'server:variables' });
            console.error('Error moving variable:', error);
        });
    }

    return (
        <>
            <div className="grid grid-cols-1 gap-4 mt-4">
                <div>
                    <Label htmlFor="environment">{t('moveDialog.environment')}</Label>
                    <Select
                        id="environment"
                        value={targetEnvironment}
                        onChange={(e) => setTargetEnvironment(e.target.value)}
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
            </div>
            <Dialog.Footer>
                <Button.Text onClick={() => close()}>
                    {t('moveDialog.cancel')}
                </Button.Text>
                <Button onClick={handleSubmit} disabled={!targetEnvironment || targetEnvironment === environment}>
                    {t('moveDialog.move')}
                </Button>
            </Dialog.Footer>
        </>
    )
}

export default asDialog({
    title: "Move Variable",
    extraWidth: true
})(MoveVariableDialog);
