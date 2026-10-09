import React, { useState } from 'react';
import { RouteComponentProps } from 'react-router';
import { Link } from 'react-router-dom';
import performPasswordReset from '@/api/auth/performPasswordReset';
import { httpErrorToHuman } from '@/api/http';
import LoginFormContainer from '@/components/auth/LoginFormContainer';
import { Actions, useStoreActions } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import { Formik, FormikHelpers } from 'formik';
import { object, ref, string } from 'yup';
import Field from '@/components/elements/Field';
import Input from '@/components/elements/Input';
import tw from 'twin.macro';
import { Button } from '@/components/elements/button/index';
import { useTranslation } from 'react-i18next';

interface Values {
    password: string;
    passwordConfirmation: string;
}

export default ({ match, location }: RouteComponentProps<{ token: string }>) => {
    const { t } = useTranslation('arix/auth');
    const [email, setEmail] = useState('');

    const { clearFlashes, addFlash } = useStoreActions((actions: Actions<ApplicationStore>) => actions.flashes);

    const parsed = new URLSearchParams(location.search);
    if (email.length === 0 && parsed.get('email')) {
        setEmail(parsed.get('email') || '');
    }

    const submit = ({ password, passwordConfirmation }: Values, { setSubmitting }: FormikHelpers<Values>) => {
        clearFlashes();
        performPasswordReset(email, { token: match.params.token, password, passwordConfirmation })
            .then(() => {
                // @ts-expect-error this is valid
                window.location = '/';
            })
            .catch((error) => {
                console.error(error);

                setSubmitting(false);
                addFlash({ type: 'error', title: 'Error', message: httpErrorToHuman(error) });
            });
    };

    return (
        <Formik
            onSubmit={submit}
            initialValues={{
                password: '',
                passwordConfirmation: '',
            }}
            validationSchema={object().shape({
                password: string().required(t('reset.password-required')).min(8, t('reset.at-least-8-characters')),
                passwordConfirmation: string()
                    .required(t('reset.password-does-not-match'))
                    // @ts-expect-error this is valid
                    .oneOf([ref('password'), null], t('reset.password-does-not-match')),
            })}
        >
            {({ isSubmitting }) => (
                <LoginFormContainer title={t('reset.title')} css={tw`w-full flex`}>
                    <div>
                        <label>{t('reset.email')}</label>
                        <Input value={email} disabled />
                    </div>
                    <div css={tw`mt-6`}>
                        <Field
                            label={t('reset.password')}
                            name={'password'}
                            type={'password'}
                            description={t('reset.at-least-8-characters')}
                        />
                    </div>
                    <div css={tw`mt-6`}>
                        <Field label={t('reset.confirm-password')} name={'passwordConfirmation'} type={'password'} />
                    </div>
                    <div css={tw`mt-6`}>
                        <Button type={'submit'} disabled={isSubmitting} className={'w-full !py-3'}>
                            {t('reset.title')}
                        </Button>
                    </div>
                    <div css={tw`mt-6 text-center`}>
                        <Link
                            to={'/auth/login'}
                            css={tw`text-xs text-neutral-300 tracking-wide uppercase no-underline hover:text-neutral-200`}
                        >
                            {t('reset.return-to-login')}
                        </Link>
                    </div>
                </LoginFormContainer>
            )}
        </Formik>
    );
};
