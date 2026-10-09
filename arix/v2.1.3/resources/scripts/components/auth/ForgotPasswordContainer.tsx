import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import requestPasswordResetEmail from '@/api/auth/requestPasswordResetEmail';
import { httpErrorToHuman } from '@/api/http';
import LoginFormContainer from '@/components/auth/LoginFormContainer';
import { useStoreState } from 'easy-peasy';
import Field from '@/components/elements/Field';
import { Formik, FormikHelpers } from 'formik';
import { object, string } from 'yup';
import tw from 'twin.macro';
import { AtSymbolIcon } from '@heroicons/react/outline';
import { Button } from '@/components/elements/button/index';
import Reaptcha from 'reaptcha';
import useFlash from '@/plugins/useFlash';
import { useTranslation } from 'react-i18next';
import Turnstile, { useTurnstile } from 'react-turnstile';

interface Values {
    email: string;
}

export default () => {
    const { t } = useTranslation('arix/auth');
    const ref = useRef<Reaptcha>(null);
    const turnstile = useTurnstile();
    const [token, setToken] = useState('');

    const { clearFlashes, addFlash } = useFlash();
    const { recaptcha: recaptchaSettings, turnstile: turnstileSettings } = useStoreState(
        (state) => state.settings.data!
    );

    useEffect(() => {
        clearFlashes();
    }, []);

    const handleSubmission = ({ email }: Values, { setSubmitting, resetForm }: FormikHelpers<Values>) => {
        clearFlashes();

        // If there is no token in the state yet, request the token and then abort this submit request
        // since it will be re-submitted when the recaptcha data is returned by the component.
        if (recaptchaSettings.enabled && recaptchaSettings.method && !token) {
            if (recaptchaSettings.method === 'recaptcha') {
                ref.current!.execute().catch((error) => {
                    console.error(error);

                    setSubmitting(false);
                    addFlash({ type: 'error', title: 'Error', message: httpErrorToHuman(error) });
                });
            } else if (recaptchaSettings.method === 'turnstile') {
                turnstile.execute().catch((error: unknown) => {
                    console.error(error);

                    setSubmitting(false);
                    addFlash({ type: 'error', title: 'Error', message: httpErrorToHuman(error as Error) });
                });
            }

            return;
        }

        requestPasswordResetEmail(email, token)
            .then((response) => {
                resetForm();
                addFlash({ type: 'success', title: 'Success', message: response });
            })
            .catch((error) => {
                console.error(error);
                addFlash({ type: 'error', title: 'Error', message: httpErrorToHuman(error) });
            })
            .then(() => {
                setToken('');
                if (recaptchaSettings.enabled && recaptchaSettings.method) {
                    if (recaptchaSettings.method === 'recaptcha') {
                        ref.current!.reset();
                    } else if (recaptchaSettings.method === 'turnstile') {
                        turnstile.reset();
                    }
                }

                setSubmitting(false);
            });
    };

    return (
        <Formik
            onSubmit={handleSubmission}
            initialValues={{ email: '' }}
            validationSchema={object().shape({
                email: string().email(t('forgot.a-valid-email-provided')).required(t('forgot.a-valid-email-provided')),
            })}
        >
            {({ isSubmitting, setSubmitting, submitForm }) => (
                <LoginFormContainer title={t('forgot.title')} css={tw`w-full flex`}>
                    <div className='mb-3'>
                        <Field
                            label={t('forgot.email')}
                            placeholder={t('forgot.email')}
                            icon={AtSymbolIcon}
                            description={t('forgot.email-description')}
                            name={'email'}
                            type={'email'}
                        />
                    </div>
                    <div className={'z-50 relative'}>
                        {recaptchaSettings.enabled &&
                            recaptchaSettings.method &&
                            (recaptchaSettings.method === 'recaptcha' ? (
                                <Reaptcha
                                    ref={ref}
                                    size={'invisible'}
                                    sitekey={recaptchaSettings.siteKey || '_invalid_key'}
                                    onVerify={(response) => {
                                        setToken(response);
                                        submitForm();
                                    }}
                                    onExpire={() => {
                                        setSubmitting(false);
                                        setToken('');
                                    }}
                                />
                            ) : (
                                recaptchaSettings.method === 'turnstile' && (
                                    <Turnstile
                                        sitekey={turnstileSettings.siteKey || '_invalid_key'}
                                        execution='render'
                                        appearance='always'
                                        onVerify={(response) => {
                                            setToken(response);
                                        }}
                                        onExpire={() => {
                                            setSubmitting(false);
                                            setToken('');
                                        }}
                                    />
                                )
                            ))}
                    </div>
                    <div css={tw`mt-3`}>
                        <Button type={'submit'} disabled={isSubmitting} className={'w-full !py-3'}>
                            {t('forgot.send-email')}
                        </Button>
                    </div>
                    <div css={tw`mt-6 text-center`}>
                        <Link
                            to={'/auth/login'}
                            css={tw`text-xs text-neutral-300 tracking-wide uppercase no-underline hover:text-neutral-200`}
                        >
                            {t('forgot.return-to-login')}
                        </Link>
                    </div>
                </LoginFormContainer>
            )}
        </Formik>
    );
};
