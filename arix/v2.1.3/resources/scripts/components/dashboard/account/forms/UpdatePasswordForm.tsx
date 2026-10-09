import React from 'react';
import { Actions, State, useStoreActions, useStoreState } from 'easy-peasy';
import { Form, Formik, FormikHelpers } from 'formik';
import Field from '@/components/elements/Field';
import * as Yup from 'yup';
import TitledGreyBox from '@/components/elements/TitledGreyBox';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import updateAccountPassword from '@/api/account/updateAccountPassword';
import { httpErrorToHuman } from '@/api/http';
import { ApplicationStore } from '@/state';
import tw from 'twin.macro';
import { Button } from '@/components/elements/button/index';
import { KeyIcon } from '@heroicons/react/outline';
import { useTranslation } from 'react-i18next';

interface Values {
    current: string;
    password: string;
    confirmPassword: string;
}

const STRENGTH_LEVELS = [{ width: '20' }, { width: '40' }, { width: '60' }, { width: '80' }, { width: '100' }];

const PasswordStrengthMeter = ({ password }: { password: string }) => {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    const level = STRENGTH_LEVELS[Math.min(score, STRENGTH_LEVELS.length - 1)];

    return (
        <div css={tw`mt-2`}>
            <div css={tw`h-1.5 w-full rounded bg-neutral-500`}>
                <div
                    style={{
                        width: !password ? '0%' : level.width + '%',
                        transition: 'width 0.3s ease, background-color 0.3s ease',
                    }}
                    css={tw`h-1.5 rounded`}
                    className={score < 2 ? 'bg-red-500' : score < 4 ? 'bg-yellow-500' : 'bg-green-500'}
                />
            </div>
        </div>
    );
};

const schema = Yup.object().shape({
    current: Yup.string().min(1).required('You must provide your current password.'),
    password: Yup.string().min(8).required(),
    confirmPassword: Yup.string().test(
        'password',
        'Password confirmation does not match the password you entered.',
        function (value) {
            return value === this.parent.password;
        }
    ),
});

export default () => {
    const { t } = useTranslation('arix/account');

    const user = useStoreState((state: State<ApplicationStore>) => state.user.data);
    const { clearFlashes, addFlash } = useStoreActions((actions: Actions<ApplicationStore>) => actions.flashes);

    if (!user) {
        return null;
    }

    const submit = (values: Values, { setSubmitting }: FormikHelpers<Values>) => {
        clearFlashes('account:password');
        updateAccountPassword({ ...values })
            .then(() => {
                // @ts-expect-error this is valid
                window.location = '/auth/login';
            })
            .catch((error) =>
                addFlash({
                    key: 'account:password',
                    type: 'error',
                    title: 'Error',
                    message: httpErrorToHuman(error),
                })
            )
            .then(() => setSubmitting(false));
    };

    return (
        <TitledGreyBox title={t('update-password.update')}>
            <React.Fragment>
                <Formik
                    onSubmit={submit}
                    validationSchema={schema}
                    initialValues={{ current: '', password: '', confirmPassword: '' }}
                >
                    {({ isSubmitting, isValid, values }) => (
                        <React.Fragment>
                            <SpinnerOverlay size={'large'} visible={isSubmitting} />
                            <Form css={tw`m-0`}>
                                <Field
                                    icon={KeyIcon}
                                    id={'current_password'}
                                    type={'password'}
                                    name={'current'}
                                    placeholder={t('update-password.current')}
                                    label={t('update-password.current')}
                                />
                                <div css={tw`mt-6`}>
                                    <Field
                                        icon={KeyIcon}
                                        id={'new_password'}
                                        type={'password'}
                                        name={'password'}
                                        placeholder={t('update-password.new')}
                                        label={t('update-password.new')}
                                        description={t('update-password.requirements')}
                                    />
                                    <PasswordStrengthMeter password={values.password} />
                                </div>
                                <div css={tw`mt-6`}>
                                    <Field
                                        icon={KeyIcon}
                                        id={'confirm_new_password'}
                                        type={'password'}
                                        name={'confirmPassword'}
                                        placeholder={t('update-password.confirm')}
                                        label={t('update-password.confirm')}
                                    />
                                </div>
                                <div css={tw`mt-6 text-right`}>
                                    <Button disabled={isSubmitting || !isValid}>{t('update-password.update')}</Button>
                                </div>
                            </Form>
                        </React.Fragment>
                    )}
                </Formik>
            </React.Fragment>
        </TitledGreyBox>
    );
};
