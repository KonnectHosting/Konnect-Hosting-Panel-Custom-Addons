import React, { useContext, useState } from 'react';
import { Field, Form, Formik, FormikHelpers } from 'formik';
import { object, string } from 'yup';
import FormikFieldWrapper from '@/components/elements/FormikFieldWrapper';
import createApiKey from '@/api/account/createApiKey';
import { Actions, useStoreActions } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import { httpErrorToHuman } from '@/api/http';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import { ApiKey } from '@/api/account/getApiKeys';
import tw from 'twin.macro';
import { Button } from '@/components/elements/button/index';
import Input, { Textarea } from '@/components/elements/Input';
import styled from 'styled-components/macro';
import ApiKeyModal from '@/components/dashboard/account/ApiKeyModal';
import { useTranslation } from 'react-i18next';
import asDialog from '@/hoc/asDialog';
import { Dialog, DialogWrapperContext } from '@/components/elements/dialog';
import { useSignal } from '@preact/signals-react';
import FlashMessageRender from '@/components/FlashMessageRender';

interface Values {
    description: string;
    allowedIps: string;
    expiresAt: string;
}

const CustomTextarea = styled(Textarea)`
    ${tw`h-32`}
`;

const CreateApiKeyDialog = asDialog(() => {
    const { t } = useTranslation('arix/account');
    return {
        title: t('apiKey.create-api-key'),
        description: t('apiKey.create-new-api-key'),
    };
})(({ onKeyCreated }: { onKeyCreated: (key: ApiKey, fullToken: string) => void }) => {
    const { t } = useTranslation('arix/account');
    const { addError, clearFlashes } = useStoreActions((actions: Actions<ApplicationStore>) => actions.flashes);
    const { close } = useContext(DialogWrapperContext);

    const submit = (values: Values, { setSubmitting, resetForm }: FormikHelpers<Values>) => {
        clearFlashes('account');
        createApiKey(values.description, values.allowedIps, values.expiresAt || undefined)
            .then(({ secretToken, ...key }) => {
                resetForm();
                setSubmitting(false);
                const fullToken = `${key.identifier}${secretToken}`;
                onKeyCreated(key, fullToken);
                close();
            })
            .catch((error) => {
                console.error(error);

                addError({ key: 'account', message: httpErrorToHuman(error) });
                setSubmitting(false);
            });
    };

    return (
        <Formik
            onSubmit={submit}
            initialValues={{ description: '', allowedIps: '', expiresAt: '' }}
            validationSchema={object().shape({
                allowedIps: string(),
                description: string().required().min(4),
                expiresAt: string(),
            })}
        >
            {({ isSubmitting, submitForm }) => (
                <Form>
                    <SpinnerOverlay visible={isSubmitting} />
                    <FormikFieldWrapper
                        label={t('apiKey.label')}
                        name={'description'}
                        description={t('apiKey.description')}
                        css={tw`mb-6 mt-3`}
                    >
                        <Field name={'description'} placeholder={t('apiKey.label')} as={Input} />
                    </FormikFieldWrapper>
                    <FormikFieldWrapper
                        label={t('apiKey.allowedIPs-label')}
                        name={'allowedIps'}
                        description={t('apiKey.allowedIPs-description')}
                        css={tw`mb-6`}
                    >
                        <Field name={'allowedIps'} as={CustomTextarea} />
                    </FormikFieldWrapper>
                    <FormikFieldWrapper
                        label={t('apiKey.expiresAt')}
                        name={'expiresAt'}
                        description={t('apiKey.expiresAt-description')}
                    >
                        <Field
                            name={'expiresAt'}
                            type={'date'}
                            placeholder={t('apiKey.expiresAt')}
                            as={Input}
                        />
                    </FormikFieldWrapper>
                    <Dialog.Footer>
                        <Button.Text onClick={close}>Cancel</Button.Text>
                        <Button onClick={submitForm} disabled={isSubmitting}>
                            {t('apiKey.createButton')}
                        </Button>
                    </Dialog.Footer>
                </Form>
            )}
        </Formik>
    );
});

export default ({ onKeyCreated }: { onKeyCreated: (key: ApiKey) => void }) => {
    const [fullToken, setFullToken] = useState('');
    const open = useSignal(false);
    const { t } = useTranslation('arix/account');

    return (
        <>
            <FlashMessageRender byKey={'account'} />
            <ApiKeyModal open={fullToken.length > 0} onClose={() => setFullToken('')} apiKey={fullToken} />
            <CreateApiKeyDialog
                open={open.value}
                onClose={() => (open.value = false)}
                onKeyCreated={(key, token) => {
                    setFullToken(token);
                    onKeyCreated(key);
                }}
            />
            <Button onClick={() => (open.value = true)}>{t('apiKey.create-api-key')}</Button>
        </>
    );
};
