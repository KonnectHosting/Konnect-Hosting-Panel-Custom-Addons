import React, { useMemo } from 'react';
import styled from 'styled-components/macro';
import { v4 } from 'uuid';
import tw from 'twin.macro';
import Label from '@/components/elements/Label';
import Input from '@/components/elements/Input';

const ToggleContainer = styled.div`
    ${tw`relative select-none w-12 leading-normal`};

    & > input[type='checkbox'] {
        ${tw`hidden`};

        &:checked + label {
            ${tw`bg-arix border-arix shadow-none`};
        }

        &:checked + label:before {
            right: 0.125rem;
            background-color: white;
        }
    }

    & > label {
        ${tw`mb-0 block overflow-hidden cursor-pointer bg-gray-600 border border-gray-500 rounded-full h-6 shadow-inner`};
        transition: all 75ms linear;

        &::before {
            ${tw`absolute block bg-[#A1A1B5] border h-5 w-5 rounded-full`};
            top: 0.125rem;
            right: calc(50% + 0.125rem);
            //width: 1.25rem;
            //height: 1.25rem;
            content: '';
            transition: all 75ms ease-in;
        }
    }
`;

export interface SwitchProps {
    name: string;
    id?: string;
    label?: string;
    description?: string;
    checked?: boolean;
    defaultChecked?: boolean;
    readOnly?: boolean;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
    children?: React.ReactNode;
}

const Switch = ({
    name,
    id,
    label,
    description,
    checked,
    defaultChecked,
    readOnly,
    onChange,
    onBlur,
    children,
}: SwitchProps) => {
    const uuid = useMemo(() => v4(), []);
    const inputId = id ?? uuid;

    const inputNode = children || (
        <Input
            id={inputId}
            name={name}
            type={'checkbox'}
            onChange={(e) => onChange && onChange(e)}
            onBlur={(e) => onBlur && onBlur(e)}
            checked={checked}
            defaultChecked={checked === undefined ? defaultChecked : undefined}
            disabled={readOnly}
        />
    );

    return (
        <div css={tw`flex items-center gap-x-2 justify-between`}>
            {(label || description) && (
                <div css={tw`flex-1`}>
                    {label && (
                        <label css={tw`text-sm cursor-pointer font-medium text-gray-200`} htmlFor={inputId}>
                            {label}
                        </label>
                    )}
                    {description && <p css={tw`text-neutral-300 text-sm`}>{description}</p>}
                </div>
            )}
            <ToggleContainer css={tw`flex-none`}>
                {inputNode}
                <Label htmlFor={inputId} />
            </ToggleContainer>
        </div>
    );
};

export default Switch;
