import React, { memo, useCallback, useState } from 'react';
import { useField } from 'formik';
import TitledGreyBox from '@/components/elements/TitledGreyBox';
import tw from 'twin.macro';
import Input from '@/components/elements/Input';
import isEqual from 'react-fast-compare';
import { ChevronDownIcon } from '@heroicons/react/outline';

interface Props {
    isEditable: boolean;
    title: string;
    permissions: string[];
    className?: string;
}

const PermissionTitleBox: React.FC<Props> = memo(({ isEditable, title, permissions, className, children }) => {
    const [{ value }, , { setValue }] = useField<string[]>('permissions');
    const [isOpen, setIsOpen] = useState(true);

    const onCheckboxClicked = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            if (e.currentTarget.checked) {
                setValue([...value, ...permissions.filter((p) => !value.includes(p))]);
            } else {
                setValue(value.filter((p) => !permissions.includes(p)));
            }
        },
        [permissions, value]
    );

    return (
        <TitledGreyBox
            title={
                <div css={tw`flex items-center`}>
                    <div className='flex-1 flex items-center cursor-pointer' onClick={() => setIsOpen(!isOpen)}>
                        <ChevronDownIcon
                            className={`w-5 h-5 mr-2 transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`}
                        />
                        <p css={tw`text-sm uppercase flex-1`}>{title}</p>
                    </div>
                    {isEditable && (
                        <Input
                            type={'checkbox'}
                            checked={permissions.every((p) => value.includes(p))}
                            onChange={onCheckboxClicked}
                        />
                    )}
                </div>
            }
            className={className}
        >
            {isOpen ? (
                children
            ) : (
                <div>
                    <p css={tw`text-gray-300 text-sm`}>{`${permissions.length} permission${
                        permissions.length !== 1 ? 's' : ''
                    } hidden`}</p>
                </div>
            )}
        </TitledGreyBox>
    );
}, isEqual);

export default PermissionTitleBox;
