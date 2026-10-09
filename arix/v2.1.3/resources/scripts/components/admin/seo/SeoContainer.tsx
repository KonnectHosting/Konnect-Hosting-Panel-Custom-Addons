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
import getSeo, { SeoSettings, updateSeo } from '@/api/admin/Seo';
import ColorField from '../elements/ColorField';

export default () => {
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<SeoSettings | null>(null);
    const { clearFlashes, addFlash } = useFlash();
    const [previewHash, setPreviewHash] = useState('');

    useEffect(() => {
        clearFlashes();
    }, []);

    useEffect(() => {
        getSeo()
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

    const handleSubmit = (values: SeoSettings) => {
        clearFlashes();

        const payload: SeoSettings = {
            ...values,
            index: Boolean(values.index),
        };

        return updateSeo(payload)
            .then((updated) => {
                setData(updated ?? payload);
                addFlash({ type: 'success', message: 'SEO settings updated successfully.' });
            })
            .catch((error) => {
                addFlash({ type: 'error', message: httpErrorToHuman(error) });
            });
    };

    const initialValues: SeoSettings = {
        index: data?.index ?? false,
        color: data?.color ?? '',
        favicon: data?.favicon ?? '',
        title: data?.title ?? '',
        description: data?.description ?? '',
        image: data?.image ?? '',
    };

    return (
        <EditorWrapper title='SEO Settings' previewHash={previewHash}>
            <FlashMessageRender />
            {isLoading || !data ? (
                <Spinner size='large' centered />
            ) : (
                <Formik<SeoSettings> initialValues={initialValues} enableReinitialize onSubmit={handleSubmit}>
                    {({ isSubmitting, submitForm }) => (
                        <React.Fragment>
                            <FormPreviewHashSync
                                prefix={'arix-meta'}
                                initialValues={initialValues}
                                onHashChange={setPreviewHash}
                            />
                            <BorderedBox title='Indexing'>
                                <SwitchField
                                    name='index'
                                    label='Allow to be indexed'
                                    description='Allow search engines to index the panel and show it in search results.'
                                />
                            </BorderedBox>
                            <BorderedBox title='Meta Settings'>
                                <Field
                                    name='favicon'
                                    label='Favicon'
                                    description='The favicon shown in search results and browser tabs.'
                                />
                                <Field name='title' label='Meta Title' />
                                <Field name='description' label='Meta Description' />
                                <Field name='image' label='Page Banner' />
                                <ColorField name='color' label='Meta Color' />
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
