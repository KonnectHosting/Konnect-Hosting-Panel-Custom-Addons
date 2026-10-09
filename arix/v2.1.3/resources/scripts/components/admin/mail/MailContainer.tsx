import React, { useEffect, useState } from 'react';
import MailBuilder from './MailBuilder';
import EditorWrapper from '../elements/EditorWrapper';
import BorderedBox from '../elements/BorderedBox';
import Input, { Textarea } from '@/components/elements/Input';
import getMail, { MailSettings, testMail, updateMail } from '@/api/admin/Mail';
import useFlash from '@/plugins/useFlash';
import { httpErrorToHuman } from '@/api/http';
import FlashMessageRender from '@/components/FlashMessageRender';
import Spinner from '@/components/elements/Spinner';
import { Formik, FieldProps, Field as FormikField } from 'formik';
import Button from '@/components/elements/button/Button';
import Label from '@/components/elements/Label';
import Code from '@/components/elements/Code';
import Field from '@/components/elements/Field';
import SwitchField from '@/components/elements/SwitchField';
import ColorField from '../elements/ColorField';
import { Dialog } from '@/components/elements/dialog';

const SendMailDialog = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const { clearFlashes, addFlash } = useFlash();

    const sendTestMail = () => {
        clearFlashes();
        setIsSending(true);

        testMail()
            .then(() => {
                addFlash({ type: 'success', message: 'Test mail sent successfully.' });
                setIsOpen(false);
            })
            .catch((error) => {
                addFlash({ type: 'error', message: httpErrorToHuman(error) });
            })
            .finally(() => setIsSending(false));
    };

    return (
        <>
            <Button onClick={() => setIsOpen(true)}>Test Mail</Button>
            <Dialog open={isOpen} title='Send Test Mail' onClose={() => setIsOpen(false)}>
                <p className='text-sm'>
                    This will send a test mail to the email address of the admin user. This is useful to test if your
                    mail settings are working correctly.
                </p>
                <p className='text-sm mt-2'>Keep in mind, you have to hit save before sending a test mail.</p>

                <Dialog.Footer>
                    <Button.Text onClick={() => setIsOpen(false)}>Cancel</Button.Text>
                    <Button onClick={sendTestMail} disabled={isSending} className='flex gap-x-2 items-center'>
                        Send Test Mail
                        {isSending && <Spinner size='small' />}
                    </Button>
                </Dialog.Footer>
            </Dialog>
        </>
    );
};

export default () => {
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<MailSettings | null>(null);
    const { clearFlashes, addFlash } = useFlash();

    useEffect(() => {
        clearFlashes();
    }, []);

    useEffect(() => {
        getMail()
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

    const handleSubmit = (values: MailSettings) => {
        clearFlashes();

        const payload: MailSettings = {
            ...values,
            logoFull: Boolean(values.logoFull),
        };

        return updateMail(payload)
            .then((updated) => {
                setData(updated ?? payload);
                addFlash({ type: 'success', message: 'Mail settings updated successfully.' });
            })
            .catch((error) => {
                addFlash({ type: 'error', message: httpErrorToHuman(error) });
            });
    };

    const initialValues: MailSettings = {
        editor: data?.editor ?? 'simple',

        logo: data?.logo ?? '',
        logoFull: Boolean(data?.logoFull),

        editorCode: data?.editorCode ?? '',
        editorJson: data?.editorJson ?? '',

        developerCode: data?.developerCode ?? '',

        template: data?.template ?? 'default',

        color: data?.color ?? '#000000',

        status: data?.status ?? '',
        billing: data?.billing ?? '',
        support: data?.support ?? '',
    };

    return (
        <EditorWrapper title='Mail Settings' size='large'>
            <FlashMessageRender />
            {isLoading || !data ? (
                <Spinner size='large' centered />
            ) : (
                <Formik<MailSettings> initialValues={initialValues} enableReinitialize onSubmit={handleSubmit}>
                    {({ isSubmitting, setFieldValue, submitForm, values }) => (
                        <React.Fragment>
                            <BorderedBox
                                title='Choose Editor'
                                description='Choose your mail template and customize it to your needs.'
                            >
                                <div className='grid grid-cols-3 gap-2'>
                                    <label className='bg-gray-600 border border-gray-500 rounded-component cursor-pointer px-4 py-3'>
                                        <div className='flex items-center gap-1 mb-1'>
                                            <Input
                                                name='editor'
                                                type='radio'
                                                value={'simple'}
                                                checked={values.editor === 'simple'}
                                                onChange={() => setFieldValue('editor', 'simple')}
                                            />
                                            <p className='font-medium'>Simple</p>
                                        </div>
                                        <p className='text-sm'>Use default mail templates & settings</p>
                                    </label>
                                    <label className='bg-gray-600 border border-gray-500 rounded-component cursor-pointer px-4 py-3'>
                                        <div className='flex items-center gap-1 mb-1'>
                                            <Input
                                                name='editor'
                                                type='radio'
                                                value={'editor'}
                                                checked={values.editor === 'editor'}
                                                onChange={() => setFieldValue('editor', 'editor')}
                                            />
                                            <p className='font-medium'>Advanced</p>
                                        </div>
                                        <p className='text-sm'>Make a mail template using drag & drop</p>
                                    </label>
                                    <label className='bg-gray-600 border border-gray-500 rounded-component cursor-pointer px-4 py-3'>
                                        <div className='flex items-center gap-1 mb-1'>
                                            <Input
                                                name='editor'
                                                type='radio'
                                                value={'developer'}
                                                checked={values.editor === 'developer'}
                                                onChange={() => setFieldValue('editor', 'developer')}
                                            />
                                            <p className='font-medium'>Developer</p>
                                        </div>
                                        <p className='text-sm'>Program your own mail template.</p>
                                    </label>
                                </div>
                            </BorderedBox>
                            {values.editor === 'simple' && (
                                <>
                                    <BorderedBox title='Simple Editor'>
                                        <div className='space-y-2'>
                                            <p className='text-sm'>
                                                Use the default mail template and customize it using the options below.
                                            </p>
                                            <p className='text-sm'>This is the recommended option for most users.</p>
                                        </div>
                                        <Field name='logo' label='Logo URL' />
                                        <SwitchField
                                            name='logoFull'
                                            label='Remove Title'
                                            description='Show the logo without the title.'
                                        />
                                        <ColorField
                                            name='color'
                                            label='Primary Color'
                                            description='The primary color used in the mail template. It is recommended to use the same color as your panel.'
                                        />
                                    </BorderedBox>
                                    <BorderedBox
                                        title='Socials'
                                        description="Leave empty if you don't want to show them in the mails."
                                    >
                                        <Field name='status' label='Status page' type='textarea' />
                                        <Field name='billing' label='Billing area' type='textarea' />
                                        <Field name='support' label='Support page' type='textarea' />
                                    </BorderedBox>
                                </>
                            )}
                            {values.editor === 'editor' && (
                                <BorderedBox title='Advanced Editor'>
                                    <div className='space-y-2'>
                                        <p className='text-sm'>
                                            Customize mail templates using our drag & drop editor. You can customize the
                                            layout, colors and content of your mails.
                                        </p>
                                        <p className='text-sm'>
                                            Keep in mind, this is can be complex and is not recommended for beginners.
                                        </p>
                                    </div>
                                    <MailBuilder
                                        updateEditor={(html, design) => {
                                            setFieldValue('editorCode', html);
                                            setFieldValue('editorJson', design);
                                        }}
                                        values={values.editorJson}
                                    />
                                </BorderedBox>
                            )}
                            {values.editor === 'developer' && (
                                <BorderedBox title='Developer Editor'>
                                    <div className='space-y-2'>
                                        <p className='text-sm'>
                                            Customize mail templates by programming them yourself. You can use HTML and
                                            CSS to create your own mail templates.
                                        </p>
                                        <p className='text-sm'>
                                            Keep in mind, this is only recommended for developers who know what they are
                                            doing.
                                        </p>
                                    </div>
                                    <FormikField name='developerCode'>
                                        {({ field }: FieldProps) => (
                                            <div>
                                                <Label htmlFor='developerCode'>Email Code</Label>
                                                <Textarea {...field} rows={10} />
                                            </div>
                                        )}
                                    </FormikField>

                                    <div className='text-sm mt-2'>
                                        Variables:
                                        <ul className='list-disc list-inside ml-4'>
                                            <li>
                                                <Code>{'{greeting style="..."}'}</Code>: Generates a paragraph with a
                                                greeting message
                                            </li>
                                            <li>
                                                <Code>{'{introLines style="..."}'}</Code>: Loops all introductions lines
                                                as a paragraph
                                            </li>
                                            <li>
                                                <Code>{'{button}'}</Code>: Generates a button in the email
                                            </li>
                                            <li>
                                                <Code>{'{outroLines style="..."}'}</Code>: Loops all outro lines as a
                                                paragraph
                                            </li>
                                            <li>
                                                <Code>{'{{subCopy style="..."}}'}</Code>: Sub-copy is a paragraph with
                                                additional information
                                            </li>
                                        </ul>
                                    </div>
                                </BorderedBox>
                            )}
                            <BorderedBox
                                title='Test Mail'
                                description='Send a test mail to the email address of the admin user to see how your mail looks.'
                            >
                                <SendMailDialog />
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
