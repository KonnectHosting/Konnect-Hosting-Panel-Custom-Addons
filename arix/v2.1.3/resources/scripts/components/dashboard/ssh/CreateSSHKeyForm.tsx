import React, { useContext } from 'react';
import { Field, Form, Formik, FormikHelpers } from 'formik';
import { object, string } from 'yup';
import FormikFieldWrapper from '@/components/elements/FormikFieldWrapper';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import tw from 'twin.macro';
import { Button } from '@/components/elements/button/index';
import Input, { Textarea } from '@/components/elements/Input';
import styled from 'styled-components/macro';
import { useFlashKey } from '@/plugins/useFlash';
import { createSSHKey, useSSHKeys } from '@/api/account/ssh-keys';
import { useTranslation } from 'react-i18next';
import asDialog from '@/hoc/asDialog';
import { Dialog, DialogWrapperContext } from '@/components/elements/dialog';
import { useSignal } from '@preact/signals-react';
import { UploadIcon } from '@heroicons/react/outline';

interface Values {
    name: string;
    publicKey: string;
}

const CustomTextarea = styled(Textarea)`
    ${tw`h-32`}
`;

const CreateSShKeyDialog = asDialog(() => {
    const { t } = useTranslation('arix/account');
    return {
        title: t('sshKey.create-ssh-key'),
        description: t('sshKey.create-new-ssh-key'),
    };
})(() => {
    const { t } = useTranslation('arix/account');
    const { clearAndAddHttpError } = useFlashKey('account');
    const { mutate } = useSSHKeys();
    const { close } = useContext(DialogWrapperContext);

    const submit = (values: Values, { setSubmitting, resetForm }: FormikHelpers<Values>) => {
        clearAndAddHttpError();

        createSSHKey(values.name, values.publicKey)
            .then((key) => {
                resetForm();
                mutate((data) => (data || []).concat(key));
                close();
            })
            .catch((error) => clearAndAddHttpError(error))
            .then(() => {
                setSubmitting(false);
            });
    };

    return (
        <Formik
            onSubmit={submit}
            initialValues={{ name: '', publicKey: '' }}
            validationSchema={object().shape({
                name: string().required(),
                publicKey: string().required(),
            })}
        >
            {({ isSubmitting, submitForm, setFieldValue }) => (
                <Form>
                    <SpinnerOverlay visible={isSubmitting} />
                    <FormikFieldWrapper label={t('sshKey.createForm.key-name')} name={'name'} css={tw`mt-3 mb-6`}>
                        <Field name={'name'} placeholder={t('sshKey.createForm.key-name')} as={Input} />
                    </FormikFieldWrapper>
                    <FormikFieldWrapper
                        label={t('sshKey.createForm.public-key')}
                        name={'publicKey'}
                        description={t('sshKey.createForm.public-key-desc')}
                    >
                        <Field name={'publicKey'} as={CustomTextarea} />
                        <div css={tw`mt-2`}>
                            <label
                                css={tw`cursor-pointer inline-flex items-center gap-2 text-sm text-neutral-300 hover:text-neutral-200`}
                            >
                                <input
                                    type={'file'}
                                    accept={'.pub,text/plain'}
                                    css={tw`hidden`}
                                    onChange={(e) => {
                                        const file = e.currentTarget.files?.[0];
                                        if (!file) return;
                                        const reader = new FileReader();
                                        reader.onload = () => {
                                            setFieldValue('publicKey', (reader.result as string).trim());
                                        };
                                        reader.readAsText(file);
                                        e.currentTarget.value = '';
                                    }}
                                />
                                <UploadIcon className='w-4' />
                                {t('sshKey.createForm.upload-key')}
                            </label>
                        </div>
                    </FormikFieldWrapper>
                    <Dialog.Footer>
                        <Button.Text onClick={close}>Cancel</Button.Text>
                        <Button onClick={submitForm} disabled={isSubmitting}>
                            {t('sshKey.createForm.save')}
                        </Button>
                    </Dialog.Footer>
                </Form>
            )}
        </Formik>
    );
});

export default () => {
    const { t } = useTranslation('arix/account');
    const open = useSignal(false);

    return (
        <>
            <CreateSShKeyDialog open={open.value} onClose={() => (open.value = false)} />
            <Button onClick={() => (open.value = true)}>{t('sshKey.create-ssh-key')}</Button>
        </>
    );
};
