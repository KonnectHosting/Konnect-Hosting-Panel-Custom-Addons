import React, { useEffect, useRef, useState } from 'react';
import { Link, RouteComponentProps } from 'react-router-dom';
import login from '@/api/auth/login';
import LoginFormContainer from '@/components/auth/LoginFormContainer';
import { useStoreState } from 'easy-peasy';
import { Formik, FormikHelpers } from 'formik';
import { object, string } from 'yup';
import Field from '@/components/elements/Field';
import tw from 'twin.macro';
import { ApplicationStore } from '@/state';
import { UserCircleIcon, KeyIcon, EyeIcon, EyeOffIcon } from '@heroicons/react/outline';
import { Button } from '@/components/elements/button/index';
import Reaptcha from 'reaptcha';
import useFlash from '@/plugins/useFlash';
import { useTranslation } from 'react-i18next';
import Turnstile, { useTurnstile } from 'react-turnstile';

interface Values {
    username: string;
    password: string;
}

const LoginContainer = ({ history }: RouteComponentProps) => {
    const { t } = useTranslation('arix/auth');
    const ref = useRef<Reaptcha>(null);
    const turnstile = useTurnstile();
    const [token, setToken] = useState('');
    const [eyeOpen, setEyeOpen] = useState(false);

    const { clearFlashes, clearAndAddHttpError } = useFlash();
    const { recaptcha: recaptchaSettings, turnstile: turnstileSettings } = useStoreState(
        (state) => state.settings.data!
    );
    const registration = useStoreState((state: ApplicationStore) => state.settings.data!.arix.advanced.registration);

    useEffect(() => {
        clearFlashes();
    }, []);

    const onSubmit = (values: Values, { setSubmitting }: FormikHelpers<Values>) => {
        clearFlashes();

        if (recaptchaSettings.enabled && recaptchaSettings.method && !token) {
            if (recaptchaSettings.method === 'recaptcha') {
                ref.current!.execute().catch((error) => {
                    console.error(error);

                    setSubmitting(false);
                    clearAndAddHttpError({ error });
                });
            } else if (recaptchaSettings.method === 'turnstile') {
                turnstile.execute().catch((error: unknown) => {
                    console.error(error);

                    setSubmitting(false);
                    clearAndAddHttpError({ error: error as Error });
                });
            }

            return;
        }

        login({ ...values, recaptchaData: token })
            .then((response) => {
                if (response.complete) {
                    // @ts-expect-error this is valid
                    window.location = response.intended || '/';
                    return;
                }

                history.replace('/auth/login/checkpoint', { token: response.confirmationToken });
            })
            .catch((error) => {
                console.error(error);

                setToken('');
                if (recaptchaSettings.enabled && recaptchaSettings.method) {
                    if (recaptchaSettings.method === 'recaptcha') {
                        ref.current!.reset();
                    } else if (recaptchaSettings.method === 'turnstile') {
                        turnstile.reset();
                    }
                }

                setSubmitting(false);
                clearAndAddHttpError({ error });
            });
    };

    return (
        <Formik
            onSubmit={onSubmit}
            initialValues={{ username: '', password: '' }}
            validationSchema={object().shape({
                username: string().required(t('login.must-be-provided')),
                password: string().required(t('login.please-enter-password')),
            })}
        >
            {({ isSubmitting, setSubmitting, submitForm }) => (
                <LoginFormContainer title={t('login.title')} css={tw`w-full flex`}>
                    <Field
                        type={'text'}
                        label={t('login.username-or-email')}
                        placeholder={t('login.username-or-email')}
                        name={'username'}
                        disabled={isSubmitting}
                        icon={UserCircleIcon}
                    />
                    <div css={tw`mt-6 mb-3`}>
                        <div className={'flex justify-between'}>
                            <label className={'block text-sm text-gray-300 mb-1 sm:mb-2 font-light'}>
                                {t('login.password')}
                            </label>
                            <Link
                                to={'/auth/password'}
                                css={tw`text-sm text-neutral-300 tracking-wide underline hover:text-neutral-200 font-light`}
                            >
                                {t('login.forgot-password')}
                            </Link>
                        </div>
                        <div className={'relative'}>
                            <Field
                                type={eyeOpen ? 'text' : 'password'}
                                placeholder={t('login.password')}
                                name={'password'}
                                disabled={isSubmitting}
                                icon={KeyIcon}
                            />
                            <button
                                type={'button'}
                                className={'absolute top-2 right-2 p-1 text-gray-300'}
                                onClick={() => setEyeOpen(!eyeOpen)}
                            >
                                {eyeOpen ? <EyeOffIcon className={'w-5'} /> : <EyeIcon className={'w-5'} />}
                            </button>
                        </div>
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
                        <Button type={'submit'} className={'w-full !py-3'} disabled={isSubmitting}>
                            {t('login.login')}
                        </Button>
                    </div>
                    {registration && (
                        <div css={tw`mt-6 text-center`}>
                            <Link
                                to={'/auth/register'}
                                css={tw`text-xs text-neutral-300 tracking-wide uppercase no-underline hover:text-neutral-200`}
                            >
                                {t('login.new-here')}
                            </Link>
                        </div>
                    )}
                </LoginFormContainer>
            )}
        </Formik>
    );
};

export default LoginContainer;
