import React from 'react';
import tw from 'twin.macro';
import Icon from '@/components/elements/Icon';
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

interface State {
    hasError: boolean;
}

// eslint-disable-next-line @typescript-eslint/ban-types
class ErrorBoundary extends React.Component<{}, State> {
    state: State = {
        hasError: false,
    };

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error: Error) {
        console.error(error);
    }

    render() {
        return this.state.hasError ? (
            <div css={tw`flex items-center justify-center w-full my-10`}>
                <div className='bg-red-800/20 border border-red-700/40 text-red-100 rounded-component p-3'>
                    <div className={`flex items-center mb-1`}>
                        <Icon icon={faExclamationTriangle} className={`h-5 w-auto mr-2 text-red-500`} />
                        <p className='text-lg font-medium text-red-50'>An error occurred</p>
                    </div>
                    <div css={tw`text-sm`}>
                        Sorry, something went wrong while trying to load this component. Please try:
                        <ul css={tw`list-disc list-inside`}>
                            <li>Refreshing the page</li>
                            <li>Clearing your browser cache</li>
                            <li>Contacting support if the issue persists</li>
                        </ul>
                    </div>
                </div>
            </div>
        ) : (
            this.props.children
        );
    }
}

export default ErrorBoundary;
