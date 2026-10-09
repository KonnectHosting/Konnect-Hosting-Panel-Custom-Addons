import Field from '@/components/elements/Field';
import { Formik } from 'formik';
import React, { useEffect, useState } from 'react';
import EditorWrapper from '../elements/EditorWrapper';
import BorderedBox from '../elements/BorderedBox';
import SwitchField from '@/components/elements/SwitchField';
import { Button } from '@/components/elements/button/index';
import getGeneral, { GeneralSettings, updateGeneral } from '@/api/admin/General';
import Spinner from '@/components/elements/Spinner';
import FlashMessageRender from '@/components/FlashMessageRender';
import useFlash from '@/plugins/useFlash';
import { httpErrorToHuman } from '@/api/http';
import FormPreviewHashSync from '@/plugins/FormPreviewHashSync';

export default () => {
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<GeneralSettings | null>(null);
    const { clearFlashes, addFlash } = useFlash();
    const [previewHash, setPreviewHash] = useState('');

    useEffect(() => {
        clearFlashes();
    }, []);

    useEffect(() => {
        getGeneral()
            .then((data) => {
                setData(data);
                setIsLoading(false);
            })
            .catch((error) => {
                clearFlashes();
                addFlash({ type: 'error', message: httpErrorToHuman(error) });
                setIsLoading(false);
            });
    }, []);

    const handleSubmit = (values: GeneralSettings) => {
        clearFlashes();

        const payload: GeneralSettings = {
            ...values,
            fullLogo: Boolean(values.fullLogo),
            logoHeight: Number(values.logoHeight),
        };

        return updateGeneral(payload)
            .then((updated) => {
                setData(updated ?? payload);
                addFlash({ type: 'success', message: 'General settings updated successfully.' });
            })
            .catch((error) => {
                addFlash({ type: 'error', message: httpErrorToHuman(error) });
            });
    };

    const initialValues: GeneralSettings = {
        logo: data?.logo ?? '',
        logoLight: data?.logoLight ?? '',
        logoHeight: data?.logoHeight ?? 0,
        fullLogo: Boolean(data?.fullLogo),
        discord: data?.discord ?? '',
        support: data?.support ?? '',
    };

    return (
        <EditorWrapper title='General Settings' previewHash={previewHash}>
            <FlashMessageRender />
            {isLoading || !data ? (
                <Spinner size='large' centered />
            ) : (
                <Formik<GeneralSettings> initialValues={initialValues} enableReinitialize onSubmit={handleSubmit}>
                    {({ isSubmitting, submitForm }) => (
                        <React.Fragment>
                            <FormPreviewHashSync
                                prefix={'arix-general'}
                                initialValues={initialValues}
                                onHashChange={setPreviewHash}
                            />
                            <BorderedBox title='Panel Logo'>
                                <Field
                                    id='logo'
                                    label={'Panel Logo (Dark Theme)'}
                                    name='logo'
                                    description='This is the logo shown in darkmode'
                                />
                                <Field
                                    id='logoLight'
                                    label={'Panel Logo (Light Theme)'}
                                    name='logoLight'
                                    description='This is the logo shown in lightmode'
                                />
                                <div className='relative'>
                                    <Field
                                        id='logoHeight'
                                        label={'Logo Size'}
                                        name='logoHeight'
                                        type='number'
                                        description='This is the size of the logo (in px).'
                                    />
                                    <p className='absolute top-9 right-4'>px</p>
                                </div>
                                <SwitchField
                                    label={'Remove Title'}
                                    description={'Show the logo without the title.'}
                                    name='fullLogo'
                                />
                            </BorderedBox>
                            <BorderedBox title='Support links' description='Support links shown in the navbar.'>
                                <Field id='discord' label={'Discord Link'} name='discord' type='text' />
                                <Field id='support' label={'Support Center Link'} name='support' />
                            </BorderedBox>
                            <div className='mt-auto sticky bottom-0 px-6 pb-5 bg-gray-700 z-20'>
                                <Button className='w-full relative' onClick={submitForm} disabled={isSubmitting}>
                                    Save Changes
                                    {isSubmitting && (
                                        <div className='absolute right-4'>
                                            <Spinner size='small' />
                                        </div>
                                    )}
                                </Button>
                            </div>
                        </React.Fragment>
                    )}
                </Formik>
            )}
        </EditorWrapper>
    );
};
