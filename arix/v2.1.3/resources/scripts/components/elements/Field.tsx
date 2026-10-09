import React, { forwardRef } from 'react';
import { Field as FormikField, FieldProps } from 'formik';
import Input from '@/components/elements/Input';
import Label from '@/components/elements/Label';

interface OwnProps {
    name: string;
    light?: boolean;
    label?: string;
    description?: string;
    placeholder?: string;
    className?: string;
    icon?: React.ComponentType<{ className?: string }>;
    validate?: (value: any) => undefined | string | Promise<any>;
}

type Props = OwnProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'name'>;

const Field = forwardRef<HTMLInputElement, Props>(
    ({ id, name, light = false, label, description, validate, placeholder, className, icon: Icon, ...props }, ref) => (
        <FormikField innerRef={ref} name={name} validate={validate}>
            {({ field, form: { errors, touched } }: FieldProps) => (
                <div>
                    {label && (
                        <Label htmlFor={id} isLight={light}>
                            {label}
                        </Label>
                    )}
                    <div className={'relative'}>
                        {Icon && <Icon className={'w-5 text-gray-400 absolute top-3 left-3 pointer-events-none'} />}
                        <Input
                            id={id}
                            {...field}
                            {...props}
                            className={`${Icon ? '!pl-10' : ''} ${className ? className : ''}`}
                            placeholder={placeholder ? placeholder : ''}
                            isLight={light}
                            hasError={!!(touched[field.name] && errors[field.name])}
                        />
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
Field.displayName = 'Field';

export default Field;
