import React, { forwardRef } from 'react';
import { Field as FormikField, FieldProps } from 'formik';
import Label from '@/components/elements/Label';
import Select from '@/components/elements/Select';

interface Option {
    label: string;
    value: string | number | boolean;
    image?: React.ReactNode;
}

interface OwnProps {
    name: string;
    light?: boolean;
    label?: string;
    description?: string;
    placeholder?: string;
    className?: string;
    options: Option[];
    validate?: (value: any) => undefined | string | Promise<any>;
}

type Props = OwnProps & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'name'>;

const SelectField = forwardRef<HTMLSelectElement, Props>(
    ({ id, name, light = false, label, description, placeholder, className, options, validate, ...props }, ref) => (
        <FormikField innerRef={ref} name={name} validate={validate}>
            {({ field, form: { errors, touched } }: FieldProps) => (
                <div>
                    {label && (
                        <Label htmlFor={id} isLight={light}>
                            {label}
                        </Label>
                    )}

                    <div className={'relative'}>
                        <Select
                            id={id}
                            {...field}
                            {...props}
                            className={`rounded-component px-3 py-2 bg-gray-600 border border-gray-500 focus:outline-none focus:border-arix w-full ${
                                className ? className : ''
                            }`}
                        >
                            {placeholder && <option value=''>{placeholder}</option>}
                            {options.map((opt) => (
                                <option key={String(opt.value)} value={opt.value as any}>
                                    {opt.label}
                                </option>
                            ))}
                        </Select>
                    </div>

                    {touched[field.name] && errors[field.name] ? (
                        <p className={'input-help error text-danger-50 mt-1 text-sm'}>
                            {(errors[field.name] as string).charAt(0).toUpperCase() +
                                (errors[field.name] as string).slice(1)}
                        </p>
                    ) : description ? (
                        <p className={'input-help mt-1 text-sm text-gray-400'}>{description}</p>
                    ) : null}
                </div>
            )}
        </FormikField>
    )
);
SelectField.displayName = 'SelectField';

export default SelectField;
