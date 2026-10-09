import React from 'react';
import { Field as FormikField, FieldProps } from 'formik';
import { XIcon } from '@heroicons/react/outline';
import { RiCloseLine } from 'react-icons/ri';

interface OwnProps {
    image?: React.ReactNode;
    label?: string;
    description?: string;
    placeholder?: string;
    className?: string;
    value: string | number | boolean;
}

type Props = OwnProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value'>;

export default function OptionField({ name, label, image, description, className, value, ...props }: Props) {
    return (
        <FormikField name={name}>
            {({ field, form }: FieldProps) => {
                const checked = field.value === value;
                const handleChange = () => form.setFieldValue(field.name, value);

                return (
                    <label className={`flex flex-col w-full cursor-pointer ${className}`}>
                        <input
                            type='radio'
                            className={'hidden'}
                            name={field.name}
                            checked={checked}
                            onChange={handleChange}
                            {...props}
                        />
                        <div
                            className={`border-2 relative flex-1 z-10 rounded-component overflow-hidden flex items-center justify-center duration-300
                            ${checked ? 'bg-gray-500 border-arix' : 'bg-gray-600 border-gray-500 hover:bg-gray-500'}
                        `}
                        >
                            {image}
                        </div>
                        <p className='mt-1 font-medium text-sm'>{label}</p>
                        <p className='text-xs text-gray-300'>{description}</p>
                    </label>
                );
            }}
        </FormikField>
    );
}
