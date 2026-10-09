import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import { ExclamationCircleIcon, PlusIcon } from '@heroicons/react/outline';
import EditorWrapper from '../elements/EditorWrapper';
import BorderedBox from '../elements/BorderedBox';
import Spinner from '@/components/elements/Spinner';
import FlashMessageRender from '@/components/FlashMessageRender';
import useFlash from '@/plugins/useFlash';
import { httpErrorToHuman } from '@/api/http';
import getLink, { LinkItem, LinkSettings, updateLink } from '@/api/admin/Link';
import { Button, styles } from '@/components/elements/button/index';
import { EditorOrCreateCategory } from './LinkEditors';
import CategoryWrapper from './CategoryWrapper';
import routes from '@/routers/routes';
import Code from '@/components/elements/Code';
import DropdownMenu, { DropdownButtonRow } from '@/components/elements/DropdownMenu';

const MissingLinks = ({ links, addLink }: { links: LinkSettings | null; addLink: (link: any) => void }) => {
    const allRoutes = routes.server;

    const configuredPaths = new Set(
        Object.values(links ?? {}).flatMap((category) => category.links.map((link) => link.url))
    );

    const missingLinks = allRoutes.filter((route) => {
        if (!route.name) return false;
        if (route.path.includes(':')) return false;

        return !configuredPaths.has(route.path);
    });

    const addLinkToCategory = ({ link, categoryKey }: { link: LinkItem; categoryKey: string }) => {
        const category = links?.[categoryKey];
        if (!category) return;

        const updatedCategory = {
            ...category,
            links: [...category.links, link],
        };

        addLink({
            ...links,
            [categoryKey]: updatedCategory,
        });
    };

    if (missingLinks.length === 0) {
        return null;
    }

    return (
        <BorderedBox
            title='Missing Links'
            description='The following routes are not included in any category. Consider adding them to ensure they are accessible from the sidebar.'
        >
            <div className='border border-gray-600 rounded-component'>
                {missingLinks.map((route) => (
                    <div key={route.path} className={'border-b border-gray-600 last-of-type:border-b-0 px-4 py-3'}>
                        <div className='flex items-center justify-between'>
                            <div className='flex items-center gap-x-4'>
                                <p className='capitalize'>{route.name}</p>
                                <Code dark>{route.path}</Code>
                            </div>
                            <DropdownMenu
                                renderToggle={(onClick) => (
                                    <Button.Text onClick={onClick} size={Button.Sizes.Small}>
                                        Add to category
                                    </Button.Text>
                                )}
                            >
                                {Object.entries(links ?? {}).map(([categoryKey, category]) => (
                                    <DropdownButtonRow
                                        key={categoryKey}
                                        className='capitalize'
                                        onClick={() =>
                                            addLinkToCategory({
                                                link: {
                                                    icon: 'HiOutlineHome',
                                                    name: route.name!,
                                                    url: route.path,
                                                    nests: route.nestId ? [route.nestId] : route.nestIds || undefined,
                                                    eggs: route.eggId ? [route.eggId] : route.eggIds || undefined,
                                                    permission:
                                                        typeof route.permission === 'string'
                                                            ? [route.permission]
                                                            : route.permission || undefined,
                                                    active: true,
                                                },
                                                categoryKey: categoryKey,
                                            })
                                        }
                                    >
                                        {category.name}
                                    </DropdownButtonRow>
                                ))}
                            </DropdownMenu>
                        </div>
                    </div>
                ))}
            </div>
        </BorderedBox>
    );
};

export default () => {
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [linkSettings, setLinkSettings] = useState<LinkSettings | null>(null);
    const [isCreateCategoryDialogOpen, setIsCreateCategoryDialogOpen] = useState(false);
    const { clearFlashes, addFlash } = useFlash();

    useEffect(() => {
        clearFlashes();
    }, []);

    useEffect(() => {
        getLink()
            .then((responseSettings) => {
                setLinkSettings(responseSettings);
                setIsLoading(false);
            })
            .catch((error) => {
                clearFlashes();
                addFlash({ type: 'error', message: httpErrorToHuman(error) });
                setIsLoading(false);
            });
    }, []);

    const settingsForCreate = linkSettings ?? {};

    const submit = () => {
        setIsSubmitting(true);
        updateLink(linkSettings!)
            .then((updatedSettings) => {
                setLinkSettings(updatedSettings);
                addFlash({ type: 'success', message: 'Links settings updated successfully.' });
            })
            .catch((error) => {
                addFlash({ type: 'error', message: httpErrorToHuman(error) });
            })
            .finally(() => {
                setIsSubmitting(false);
            });
    };

    return (
        <EditorWrapper title='Configure Links' size='large'>
            <FlashMessageRender />
            <EditorOrCreateCategory
                open={isCreateCategoryDialogOpen}
                onClose={() => setIsCreateCategoryDialogOpen(false)}
                title='Create category'
                initialCategory={{
                    name: 'new-category',
                    permission: [],
                    nests: [],
                    eggs: [],
                    active: true,
                    links: [],
                }}
                onSubmit={(createdCategory) => {
                    const newKey = createdCategory.name.trim() || 'new-category';
                    setLinkSettings({
                        ...settingsForCreate,
                        [newKey]: { ...createdCategory, name: newKey },
                    });
                }}
            />
            <p className='px-6 text-sm'>
                Make search to read our docs on to manage links shown in your sidebar:
                <a
                    href='https://arix.gg/docs/configuring-routes'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='underline ml-1'
                >
                    https://arix.gg/docs/configuring-routes
                </a>
            </p>

            {isLoading || !linkSettings ? (
                <Spinner size='large' centered />
            ) : (
                <React.Fragment>
                    <BorderedBox title='Server Links' description='Configure the sidebar links for the server pages.'>
                        <div className='space-y-2'>
                            {Object.entries(linkSettings).map(([categoryName, category]) => (
                                <CategoryWrapper
                                    key={categoryName}
                                    categoryKey={categoryName}
                                    category={category}
                                    linkSettings={linkSettings}
                                    onSettingsChange={setLinkSettings}
                                />
                            ))}
                            <div
                                className={classNames(
                                    styles.button,
                                    styles.button.small,
                                    styles.text,
                                    styles.secondary,
                                    styles.small,
                                    'w-full gap-x-1'
                                )}
                                onClick={() => setIsCreateCategoryDialogOpen(true)}
                            >
                                <PlusIcon className='w-4' />
                                Add new category
                            </div>
                            <p className='text-xs text-red-400 font-medium rounded-component flex items-start gap-x-1 mt-2'>
                                <ExclamationCircleIcon className='w-3 shrink-0 mt-0.5' />
                                Updates after saving (not shown in Live Preview)
                            </p>
                        </div>
                    </BorderedBox>
                    <MissingLinks links={linkSettings} addLink={setLinkSettings} />
                </React.Fragment>
            )}
            <div className='mt-auto sticky bottom-0 px-6 pb-5 bg-gray-700 z-20'>
                <Button className='w-full relative' onClick={submit} disabled={isSubmitting}>
                    Save Changes
                    {isSubmitting && (
                        <div className='absolute right-4'>
                            <Spinner size='small' />
                        </div>
                    )}
                </Button>
            </div>
        </EditorWrapper>
    );
};
