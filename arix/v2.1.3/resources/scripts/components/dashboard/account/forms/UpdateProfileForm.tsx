import React from 'react';
import { Actions, State, useStoreActions, useStoreState } from 'easy-peasy';
import { Form, Formik, FormikHelpers } from 'formik';
import * as Yup from 'yup';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import Field from '@/components/elements/Field';
import { httpErrorToHuman } from '@/api/http';
import { ApplicationStore } from '@/state';
import tw from 'twin.macro';
import { Button } from '@/components/elements/button/index';
import { useTranslation } from 'react-i18next';
import UserAvatar from '@/components/UserAvatar';
import UpdateEmailAddressForm from './UpdateEmailAddressForm';
import FlashMessageRender from '@/components/FlashMessageRender';

interface Values {
    username: string;
    firstName: string;
    lastName: string;
}

const createSchema = (usernameEnabled: boolean, nameEnabled: boolean) =>
    Yup.object().shape({
        ...(usernameEnabled && {
            username: Yup.string().required('You must provide your username.'),
        }),
        ...(nameEnabled && {
            firstName: Yup.string().required('You must provide your first name.'),
            lastName: Yup.string().required('You must provide your last name.'),
        }),
    });

export default () => {
    const { t } = useTranslation('arix/account');
    const user = useStoreState((state: State<ApplicationStore>) => state.user.data);
    const updateProfile = useStoreActions((state: Actions<ApplicationStore>) => state.user.updateUserProfile);
    const {
        username: usernameCustomization,
        name: nameCustomization,
        email: emailCustomization,
    } = useStoreState((state: ApplicationStore) => state.settings.data!.arix.advanced.profileCustomization);
    const schema = createSchema(usernameCustomization, nameCustomization);

    const { clearFlashes, addFlash } = useStoreActions((actions: Actions<ApplicationStore>) => actions.flashes);

    const submit = (values: Values, { resetForm, setSubmitting }: FormikHelpers<Values>) => {
        clearFlashes('account:profile');

        const payload = {
            username: usernameCustomization ? values.username : user!.username,
            firstName: nameCustomization ? values.firstName : user!.firstName,
            lastName: nameCustomization ? values.lastName : user!.lastName,
        };

        updateProfile(payload)
            .then(() =>
                addFlash({
                    type: 'success',
                    key: 'account:profile',
                    message: t('profile.updated-success'),
                })
            )
            .catch((error) => {
                addFlash({
                    type: 'error',
                    key: 'account:profile',
                    title: 'Error',
                    message: httpErrorToHuman(error),
                });
                resetForm();
            })
            .then(() => {
                setSubmitting(false);
            });
    };

    if (!usernameCustomization && !nameCustomization && !emailCustomization) {
        return null;
    }

    return (
        <>
            <FlashMessageRender byKey='account:profile' />
            <div className='rounded-box bg-neutral-700 backdrop boxBorder overflow-hidden'>
                <div className={'w-full relative flex items-center justify-between px-6 pt-5 z-10'}>
                    <div
                        className={
                            'h-3/4 w-full absolute top-0 left-0 z-[-1] bg-gradient-to-r from-arix to-transparent'
                        }
                    />
                    <div className={'w-[60px] rounded-component border-4 border-gray-700 overflow-hidden'}>
                        <UserAvatar width={'60px'} rounded={'rounded-none'} />
                    </div>
                    {emailCustomization && <UpdateEmailAddressForm />}
                </div>
                {(usernameCustomization || nameCustomization) && (
                    <div className='px-6 py-5'>
                        <Formik
                            onSubmit={submit}
                            validationSchema={schema}
                            initialValues={{
                                username: user!.username,
                                firstName: user!.firstName,
                                lastName: user!.lastName,
                            }}
                        >
                            {({ isSubmitting, isValid }) => (
                                <React.Fragment>
                                    <SpinnerOverlay size={'large'} visible={isSubmitting} />
                                    <Form css={tw`m-0`}>
                                        {nameCustomization && (
                                            <div className='grid lg:grid-cols-2 gap-4 mb-6'>
                                                <Field
                                                    id={'firstName'}
                                                    type={'text'}
                                                    name={'firstName'}
                                                    className={'privacy-blur'}
                                                    label={t('profile.first-name')}
                                                />
                                                <Field
                                                    id={'lastName'}
                                                    type={'text'}
                                                    name={'lastName'}
                                                    className={'privacy-blur'}
                                                    label={t('profile.last-name')}
                                                />
                                            </div>
                                        )}
                                        {usernameCustomization && (
                                            <Field
                                                id={'username'}
                                                type={'text'}
                                                name={'username'}
                                                className={'privacy-blur'}
                                                label={t('profile.username')}
                                            />
                                        )}
                                        <div css={tw`mt-6 text-right`}>
                                            <Button disabled={isSubmitting || !isValid}>
                                                {t('profile.update-profile')}
                                            </Button>
                                        </div>
                                    </Form>
                                </React.Fragment>
                            )}
                        </Formik>
                    </div>
                )}
            </div>
        </>
    );
};
