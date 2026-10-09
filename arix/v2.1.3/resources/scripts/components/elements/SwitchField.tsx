import React from 'react';
import { Field as FormikField, FieldProps } from 'formik';
import Switch from '@/components/elements/Switch';

interface SwitchFieldProps {
    name: string;
    label?: string;
    description?: string;
    readOnly?: boolean;
    validate?: (value: boolean) => undefined | string | Promise<any>;
}

const SwitchField = ({ name, label, description, readOnly, validate }: SwitchFieldProps) => (
    <FormikField name={name} validate={validate}>
        {({ field, form: { errors, touched } }: FieldProps) => {
            const hasError = Boolean(touched[field.name] && errors[field.name]);

            return (
                <div>
                    <Switch
                        name={field.name}
                        id={field.name}
                        label={label}
                        description={!hasError ? description : undefined}
                        checked={Boolean(field.value)}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        readOnly={readOnly}
                    />
                    {hasError && (
                        <p className={'input-help error text-danger-50 mt-1 text-sm'}>
                            {(errors[field.name] as string).charAt(0).toUpperCase() +
                                (errors[field.name] as string).slice(1)}
                        </p>
                    )}
                </div>
            );
        }}
    </FormikField>
);

export default SwitchField;
