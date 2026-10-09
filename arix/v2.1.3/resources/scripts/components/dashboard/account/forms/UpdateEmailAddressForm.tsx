import React, { useContext } from 'react';
import { Actions, State, useStoreActions, useStoreState } from 'easy-peasy';
import { Form, Formik, FormikHelpers } from 'formik';
import * as Yup from 'yup';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import Field from '@/components/elements/Field';
import { httpErrorToHuman } from '@/api/http';
import { ApplicationStore } from '@/state';
import tw from 'twin.macro';
import { Button } from '@/components/elements/button/index';
import { KeyIcon, AtSymbolIcon } from '@heroicons/react/outline';
import { useTranslation } from 'react-i18next';
import asDialog from '@/hoc/asDialog';
import { Dialog, DialogWrapperContext } from '@/components/elements/dialog';
import { useSignal } from '@preact/signals-react';
import FlashMessageRender from '@/components/FlashMessageRender';

interface Values {
    email: string;
    password: string;
}

const schema = Yup.object().shape({
    email: Yup.string().email().required(),
    password: Yup.string().required('You must provide your current account password.'),
});

const UpdateEmailDialog = asDialog(() => {
    const { t } = useTranslation('arix/account');
    return {
        title: t('update-email.title'),
        description: t('update-email.description'),
    };
})(() => {
    const { t } = useTranslation('arix/account');
    const user = useStoreState((state: State<ApplicationStore>) => state.user.data);
    const updateEmail = useStoreActions((state: Actions<ApplicationStore>) => state.user.updateUserEmail);
    const { close } = useContext(DialogWrapperContext);

    const { clearFlashes, addFlash } = useStoreActions((actions: Actions<ApplicationStore>) => actions.flashes);

    const submit = (values: Values, { resetForm, setSubmitting }: FormikHelpers<Values>) => {
        clearFlashes('account:email');

        updateEmail({ ...values })
            .then(() => {
                addFlash({
                    type: 'success',
                    key: 'account:email',
                    message: t('update-email.isUpdated'),
                });
                close();
            })
            .catch((error) => {
                addFlash({
                    type: 'error',
                    key: 'account:email',
                    title: 'Error',
                    message: httpErrorToHuman(error),
                });
            })
            .then(() => {
                resetForm();
                setSubmitting(false);
            });
    };

    return (
        <div className='mt-2'>
            <Formik onSubmit={submit} validationSchema={schema} initialValues={{ email: user!.email, password: '' }}>
                {({ submitForm, isSubmitting, isValid }) => (
                    <React.Fragment>
                        <SpinnerOverlay size={'large'} visible={isSubmitting} />
                        <Form css={tw`m-0`}>
                            <Field
                                id={'current_email'}
                                icon={AtSymbolIcon}
                                type={'email'}
                                name={'email'}
                                className={'privacy-blur'}
                                label={t('update-email.email')}
                            />
                            <div css={tw`mt-6`}>
                                <Field
                                    icon={KeyIcon}
                                    id={'confirm_password'}
                                    type={'password'}
                                    name={'password'}
                                    placeholder={t('update-email.confirm')}
                                    label={t('update-email.confirm')}
                                    required
                                />
                            </div>
                            <Dialog.Footer>
                                <Button.Text onClick={close}>Cancel</Button.Text>
                                <Button onClick={submitForm} disabled={isSubmitting || !isValid}>
                                    {t('update-email.update')}
                                </Button>
                            </Dialog.Footer>
                        </Form>
                    </React.Fragment>
                )}
            </Formik>
        </div>
    );
});

export default () => {
    const { t } = useTranslation('arix/account');
    const open = useSignal(false);
    const user = useStoreState((state: State<ApplicationStore>) => state.user.data);

    return (
        <>
            <FlashMessageRender byKey='account:email' />
            <UpdateEmailDialog open={open.value} onClose={() => (open.value = false)} />

            <Button.Text onClick={() => (open.value = true)} className='gap-x-1'>
                <AtSymbolIcon css={tw`w-4 h-4`} />
                {t('update-email.change-email')}
            </Button.Text>
        </>
    );
};
