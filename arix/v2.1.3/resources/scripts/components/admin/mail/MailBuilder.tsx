import React, { useRef, useState } from 'react';
import EmailEditor, { EditorRef, EmailEditorProps } from 'react-email-editor';
import { ExternalLinkIcon } from '@heroicons/react/outline';
import { Button } from '@/components/elements/button/index';

interface EditorProps {
    onClose: () => void;
    value?: string;
    updateEditor: (html: string, design: string) => void;
}

const Editor = ({ onClose, value, updateEditor }: EditorProps) => {
    const emailEditorRef = useRef<EditorRef>(null);

    const exportHtml = () => {
        const unlayer = emailEditorRef.current?.editor;

        unlayer?.exportHtml((data) => {
            const { design, html } = data;
            updateEditor(html, JSON.stringify(design));
            onClose();
        });
    };

    const onReady: EmailEditorProps['onReady'] = (unlayer) => {
        if (!value) {
            return;
        }

        try {
            unlayer.loadDesign(JSON.parse(value));
        } catch {
            // Ignore invalid designs saved by older versions and start with a blank editor.
        }
    };

    return (
        <div className='fixed inset-0 z-50 p-10'>
            <div className='absolute inset-0 cursor-pointer bg-black bg-opacity-50' onClick={onClose} />
            <div className='bg-white rounded-box relative z-10 h-full flex flex-col'>
                <div className='flex justify-between p-4 border-b border-slate-300'>
                    <Button.Text onClick={onClose}>Exit</Button.Text>
                    <Button onClick={exportHtml}>Continue</Button>
                </div>
                <div className='absolute -z-10 w-full top-1/2 flex items-center justify-center text-gray-500'>
                    <p>Loading...</p>
                </div>
                <EmailEditor
                    ref={emailEditorRef}
                    onReady={onReady}
                    minHeight={600}
                    options={{
                        version: 'latest',
                    }}
                />
            </div>
        </div>
    );
};

export default ({ values, updateEditor }: Omit<EditorProps, 'onClose' | 'value'> & { values?: string }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div>
            {isOpen && <Editor onClose={() => setIsOpen(false)} value={values} updateEditor={updateEditor} />}
            <Button.Text className='gap-1' onClick={() => setIsOpen(true)}>
                Open Editor
                <ExternalLinkIcon className='w-4' />
            </Button.Text>
        </div>
    );
};
