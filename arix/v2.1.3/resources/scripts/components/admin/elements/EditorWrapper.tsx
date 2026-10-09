import Code from '@/components/elements/Code';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/elements/button/index';
import { DesktopComputerIcon, DeviceMobileIcon, DeviceTabletIcon, ExternalLinkIcon } from '@heroicons/react/outline';
import { mergeHashByPrefix } from '@/plugins/previewHash';

interface EditorProps {
    title: string;
    size?: 'medium' | 'large';
    previewHash?: string;
    onPreviewLoad?: (iframe: HTMLIFrameElement) => void;
    children: React.ReactNode;
}

const MIN_PREVIEW_WIDTH = 384;
const DEFAULT_PATH = '/';
const PREVIEW_PRESETS: PreviewPreset[] = [
    { label: 'Desktop', width: 12800, icon: DesktopComputerIcon },
    { label: 'Tablet', width: 768, icon: DeviceTabletIcon },
    { label: 'Mobile', width: 390, icon: DeviceMobileIcon },
];

type ResizeSide = 'left' | 'right';
type ResizeState = { side: ResizeSide; startX: number; startWidth: number };
type PreviewPreset = { label: string; width: number; icon?: React.ComponentType<{ className?: string }> };

const clampPreviewWidth = (width: number, containerWidth: number) => {
    if (containerWidth <= 0) {
        return Math.max(MIN_PREVIEW_WIDTH, width);
    }

    return Math.min(containerWidth, Math.max(MIN_PREVIEW_WIDTH, width));
};

const resolveIframePath = (iframeRef: React.RefObject<HTMLIFrameElement>) => {
    const iframeWindow = iframeRef.current?.contentWindow;
    if (!iframeWindow) {
        return DEFAULT_PATH;
    }

    const { pathname, search, hash } = iframeWindow.location;
    return `${pathname}${search}${hash}` || DEFAULT_PATH;
};

const useDocumentTitle = (title: string) => {
    useEffect(() => {
        if (title) {
            document.title = title;
        }
    }, [title]);
};

const usePreviewContainerWidth = (containerRef: React.RefObject<HTMLDivElement>) => {
    const [containerWidth, setContainerWidth] = useState(0);

    useEffect(() => {
        const node = containerRef.current;
        if (!node) {
            return;
        }

        const updateWidth = () => setContainerWidth(node.getBoundingClientRect().width);
        const observer = new ResizeObserver(updateWidth);

        updateWidth();
        observer.observe(node);

        return () => {
            observer.disconnect();
        };
    }, [containerRef]);

    return containerWidth;
};

const useIframePath = (iframeRef: React.RefObject<HTMLIFrameElement>, previewHash?: string) => {
    const intervalRef = useRef<number | null>(null);
    const [iframePath, setIframePath] = useState(DEFAULT_PATH);

    const applyPreviewHash = useCallback(() => {
        const iframeWindow = iframeRef.current?.contentWindow;
        if (!iframeWindow) {
            return;
        }

        if (!previewHash) {
            return;
        }

        const mergedHash = mergeHashByPrefix(iframeWindow.location.hash, previewHash);
        if (mergedHash !== iframeWindow.location.hash.replace(/^#/, '')) {
            iframeWindow.location.hash = mergedHash;
        }
    }, [iframeRef, previewHash]);

    const updatePath = useCallback(() => {
        setIframePath(resolveIframePath(iframeRef));
    }, [iframeRef]);

    const onIframeLoad = useCallback(() => {
        applyPreviewHash();
        updatePath();

        if (intervalRef.current !== null) {
            window.clearInterval(intervalRef.current);
        }

        intervalRef.current = window.setInterval(updatePath, 1500);
    }, [applyPreviewHash, updatePath]);

    useEffect(() => {
        applyPreviewHash();
        updatePath();
    }, [applyPreviewHash, updatePath]);

    useEffect(() => {
        return () => {
            if (intervalRef.current !== null) {
                window.clearInterval(intervalRef.current);
            }
        };
    }, []);

    return { iframePath, onIframeLoad };
};

const usePreviewResize = (containerWidth: number) => {
    const [previewWidth, setPreviewWidth] = useState<number | null>(null);
    const [isResizing, setIsResizing] = useState(false);
    const resizeStateRef = useRef<ResizeState | null>(null);

    useEffect(() => {
        if (containerWidth <= 0) {
            return;
        }

        setPreviewWidth((current) => {
            if (current === null) {
                return containerWidth;
            }

            return clampPreviewWidth(current, containerWidth);
        });
    }, [containerWidth]);

    const applyWidth = useCallback(
        (nextWidth: number) => {
            setPreviewWidth(clampPreviewWidth(nextWidth, containerWidth));
        },
        [containerWidth]
    );

    const beginResize = useCallback(
        (side: ResizeSide, event: React.MouseEvent<HTMLDivElement>) => {
            if (containerWidth <= 0) {
                return;
            }

            resizeStateRef.current = {
                side,
                startX: event.clientX,
                startWidth: previewWidth ?? containerWidth,
            };

            setIsResizing(true);
            event.preventDefault();
        },
        [containerWidth, previewWidth]
    );

    useEffect(() => {
        if (!isResizing) {
            return;
        }

        const onMouseMove = (event: MouseEvent) => {
            const resizeState = resizeStateRef.current;
            if (!resizeState) {
                return;
            }

            const deltaX = event.clientX - resizeState.startX;
            const widthDelta = (resizeState.side === 'right' ? deltaX : -deltaX) * 2;
            applyWidth(resizeState.startWidth + widthDelta);
        };

        const onMouseUp = () => {
            resizeStateRef.current = null;
            setIsResizing(false);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [applyWidth, isResizing]);

    const applyPreset = useCallback(
        (width: number) => {
            if (containerWidth <= 0) {
                return;
            }

            applyWidth(width);
        },
        [applyWidth, containerWidth]
    );

    return {
        isResizing,
        previewWidth: containerWidth > 0 ? previewWidth ?? containerWidth : null,
        beginResize,
        applyPreset,
    };
};

const ResizeHandle = ({
    side,
    onMouseDown,
}: {
    side: ResizeSide;
    onMouseDown: (side: ResizeSide, event: React.MouseEvent<HTMLDivElement>) => void;
}) => (
    <div
        className={`group absolute inset-y-0 z-10 w-2 flex items-center justify-center 
            bg-gradient-to-b from-transparent hover:via-arix/20 hover:to-transparent duration-300
            cursor-ew-resize ${side === 'left' ? 'left-0 -translate-x-1/2' : 'right-0 translate-x-1/2'}`}
        onMouseDown={(event) => onMouseDown(side, event)}
    >
        <div className='absolute w-3 h-24 bg-gray-600 rounded-full group-hover:bg-gray-500 duration-300' />
    </div>
);

export default ({ title, size, previewHash, onPreviewLoad, children }: EditorProps) => {
    const previewContainerRef = useRef<HTMLDivElement | null>(null);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const adminPreviewToken =
        typeof window !== 'undefined' &&
        typeof (window as Window & { AdminPreviewToken?: string }).AdminPreviewToken === 'string'
            ? (window as Window & { AdminPreviewToken?: string }).AdminPreviewToken!
            : '';
    const previewSrc = adminPreviewToken ? `/?admin-preview=${encodeURIComponent(adminPreviewToken)}` : '/';
    useDocumentTitle(title);

    const previewContainerWidth = usePreviewContainerWidth(previewContainerRef);
    const { iframePath, onIframeLoad } = useIframePath(iframeRef, previewHash);
    const { isResizing, previewWidth, beginResize, applyPreset } = usePreviewResize(previewContainerWidth);
    const visiblePreviewPath = iframePath.split('#')[0] || DEFAULT_PATH;

    const handleIframeLoad = useCallback(() => {
        onIframeLoad();

        if (iframeRef.current && onPreviewLoad) {
            onPreviewLoad(iframeRef.current);
        }
    }, [onIframeLoad, onPreviewLoad]);

    return (
        <div className='flex h-[calc(100dvh-57px)] p-4 gap-4'>
            <div
                className={`${
                    size === 'large' ? 'w-1/2' : size === 'medium' ? 'w-1/3' : 'w-96'
                } boxBorder bg-gray-700 rounded-box overflow-y-auto flex flex-col gap-y-4`}
            >
                <p className='text-lg font-medium text-gray-100 px-6 pt-5'>{title}</p>
                {children}
            </div>
            <div ref={previewContainerRef} className='flex-1 overflow-hidden'>
                <div className='h-full w-full overflow-hidden'>
                    <div
                        className={`relative flex duration-75 justify-center mx-auto h-full w-full max-w-full min-w-[24rem] flex-col overflow-hidden ${
                            isResizing ? 'select-none' : ''
                        }`}
                        style={
                            previewContainerWidth > 0
                                ? {
                                      width: previewWidth !== null ? `${previewWidth}px` : '100%',
                                      maxWidth: `${previewContainerWidth}px`,
                                  }
                                : undefined
                        }
                    >
                        <ResizeHandle side='left' onMouseDown={beginResize} />
                        <ResizeHandle side='right' onMouseDown={beginResize} />
                        {isResizing && <div className='absolute inset-0 z-20 cursor-ew-resize' />}
                        <div className='flex justify-between items-center bg-gray-600 rounded-b-none rounded-box px-4 py-2 text-sm'>
                            <div className='flex flex-wrap items-center gap-2'>
                                {PREVIEW_PRESETS.map((preset) => {
                                    const IconComponent = preset.icon;

                                    return (
                                        <Button.Text
                                            key={preset.label}
                                            size={Button.Sizes.Small}
                                            onClick={() => applyPreset(preset.width)}
                                            className='items-center gap-x-1'
                                        >
                                            {IconComponent && <IconComponent className='w-4 h-4' />}
                                            {preset.label}
                                        </Button.Text>
                                    );
                                })}
                            </div>
                            <a href={visiblePreviewPath} target='_blank' rel='noopener noreferrer'>
                                <Code className='flex items-center gap-x-2'>
                                    {visiblePreviewPath === 'blank' || visiblePreviewPath === previewSrc
                                        ? '/'
                                        : visiblePreviewPath}
                                    <ExternalLinkIcon className='w-4 h-4' />
                                </Code>
                            </a>
                        </div>
                        <iframe
                            ref={iframeRef}
                            src={previewSrc}
                            onLoad={handleIframeLoad}
                            className='w-full h-full !rounded-t-none rounded-box border border-gray-500'
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
