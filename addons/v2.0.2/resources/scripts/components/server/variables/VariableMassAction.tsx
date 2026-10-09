import DropdownMenu, { DropdownButtonRow, DropdownDivider } from "@/components/elements/DropdownMenu";
import ConfirmationDialog from "@/components/elements/dialog/ConfirmationDialog";
import { DotsVerticalIcon, PencilIcon, SwitchVerticalIcon, TrashIcon } from "@heroicons/react/outline";
import React, { useState } from "react";
import EditOrAddVariable from "./EditOrAddVariable";
import MoveVariableDialog from "./MoveVariableDialog";
import { removeVariable } from "@/api/server/variables";
import { ServerContext } from "@/state/server";
import { Dialog } from "@/components/elements/dialog";
import useFlash from "@/plugins/useFlash";
import { useTranslation } from "react-i18next";

export default function VariableMassActions(
    { variable, updateVariables }:
    { variable: { environment: string, key: string, value: string }, updateVariables: React.Dispatch<React.SetStateAction<Record<string, Record<string, string>>>>}
) {
    const { t } = useTranslation('arix/server/addons/variables');
    const { addFlash } = useFlash();
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const [isEditing, setIsEditing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isMoving, setIsMoving] = useState(false);

    const onDelete = () => {
        removeVariable(uuid, variable.environment, variable.key).then(() => {
            updateVariables((prev) => {
                const updated = { ...prev };
                if (updated[variable.environment]) {
                    delete updated[variable.environment][variable.key];
                }
                return updated;
            });
            addFlash({ type: 'success', message: t('deleteDialog.success', { variable: variable.key }), key: 'server:variables' });
        }).catch((error) => {
            addFlash({ type: 'error', message: `Error deleting variable: ${error.message}`, key: 'server:variables' });
            console.error('Error deleting variable:', error);
        });
    };

    return (
        <div>
            <ConfirmationDialog
                open={isDeleting}
                title={t`deleteDialog.title`}
                onClose={() => setIsDeleting(false)}
                onConfirmed={onDelete} 
                confirm={t`deleteDialog.confirm`}
                children={
                    <p>
                        {t('deleteDialog.description', { variable: variable.key, environment: variable.environment })}
                    </p>
                }
            />
            <EditOrAddVariable
                environment={variable.environment}
                variableKey={variable.key}
                value={variable.value}
                updateVariables={updateVariables}
                open={isEditing}
                onClose={() => setIsEditing(false)}
            />
            <MoveVariableDialog
                environment={variable.environment}
                variableKey={variable.key}
                value={variable.value}
                updateVariables={updateVariables}
                open={isMoving}
                onClose={() => setIsMoving(false)}
            />

            <DropdownMenu
                renderToggle={(onClick) => (
                    <button
                        onClick={onClick}
                    >
                        <DotsVerticalIcon className={'w-5'} />
                    </button>
                )}
            >
                <DropdownButtonRow onClick={() => setIsEditing(true)}>
                    <PencilIcon className={'w-5'} /> {t('edit')}
                </DropdownButtonRow>
                <DropdownButtonRow onClick={() => setIsMoving(true)}>
                    <SwitchVerticalIcon className={'w-5'} /> {t('move')}
                </DropdownButtonRow>
                <DropdownDivider />
                <DropdownButtonRow danger onClick={() => setIsDeleting(true)}>
                    <TrashIcon className={'w-5'} /> {t('delete')}
                </DropdownButtonRow>
            </DropdownMenu>
        </div>
    )
}