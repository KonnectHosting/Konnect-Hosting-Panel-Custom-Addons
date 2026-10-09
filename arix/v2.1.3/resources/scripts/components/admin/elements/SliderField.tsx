import React from 'react';
import { useField, useFormikContext } from 'formik';
import styled from 'styled-components/macro';
import tw from 'twin.macro';

interface Props {
    name: string;
    label?: string;
    min?: number;
    max?: number;
    step?: number;
    indicators?: string[];
    className?: string;
}

const Slider = styled.input`
    --track-height: 0.5rem;
    --thumb-size: 1.25rem;

    ${tw`w-full bg-transparent outline-none`}
    -webkit-appearance: none;
    appearance: none;

    &:focus {
        outline: none;
    }

    /* WebKit (Chrome, Safari, Edge Chromium, Opera) */
    &::-webkit-slider-runnable-track {
        ${tw`h-2 rounded-md bg-gray-600`}
    }

    &::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        ${tw`w-5 h-5 bg-arix rounded-full cursor-pointer border-none`}
        margin-top: calc((var(--track-height) - var(--thumb-size)) / 2);
    }

    /* Firefox */
    &::-moz-range-track {
        ${tw`h-2 rounded-md bg-gray-600`}
    }

    &::-moz-range-progress {
        ${tw`h-2 rounded-md bg-arix`}
    }

    &::-moz-range-thumb {
        ${tw`w-5 h-5 bg-gray-300 rounded-full cursor-pointer border-none`}
    }

    /* Legacy Edge / IE */
    &::-ms-track {
        width: 100%;
        height: var(--track-height);
        background: transparent;
        border-color: transparent;
        color: transparent;
    }

    &::-ms-fill-lower {
        ${tw`rounded-md bg-arix`}
    }

    &::-ms-fill-upper {
        ${tw`rounded-md bg-gray-600`}
    }

    &::-ms-thumb {
        ${tw`w-5 h-5 bg-gray-300 rounded-full cursor-pointer border-none`}
        margin-top: 0;
    }
`;

export default ({ name, label, min = 0, max = 100, step = 1, indicators = [], className }: Props) => {
    const [field, meta] = useField<any>(name);
    const { setFieldValue } = useFormikContext<any>();

    const value = Number(field.value ?? min);

    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = Number(e.target.value);
        setFieldValue(name, v);
    };

    return (
        <div className={className}>
            {label && <label>{label}</label>}
            <Slider type='range' name={field.name} min={min} max={max} step={step} value={value} onChange={onChange} />
            {indicators.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                    {indicators.map((label, i) => (
                        <span key={i} className='text-xs w-4 flex justify-center'>
                            {label}
                        </span>
                    ))}
                </div>
            )}
            {meta.touched && meta.error ? <p className='input-help error'>{String(meta.error)}</p> : null}
        </div>
    );
};
