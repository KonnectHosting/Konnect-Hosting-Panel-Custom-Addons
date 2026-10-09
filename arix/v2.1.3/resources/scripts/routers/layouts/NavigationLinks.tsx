import tw, { styled } from 'twin.macro';

const NavigationLinks = styled.div`
    ${tw`flex flex-col gap-1`};

    .routers_category-wrapper {
        ${tw`flex flex-col gap-1`};

        & .routers_category {
            ${tw`px-5 text-sm text-gray-300 font-medium mt-4 uppercase`}
        }
    }

    & .routers_links {
        ${tw`flex flex-col gap-1`};
    }

    .routers_link {
        ${tw`relative z-10 flex px-5 py-2 gap-x-2 items-center duration-300`}

        & .routers_link_icon {
            ${tw`text-gray-300`}
        }
    }

    &.default .routers_link {
        ${tw`border-r-2 border-transparent`}

        &::after {
            ${tw`absolute inset-0 z-[-1] opacity-0 duration-300`}
            content: '';
            background: linear-gradient(
                90deg,
                transparent 0%,
                color-mix(in srgb, rgb(var(--primary)) 30%, transparent) 100%
            );
        }

        &:hover,
        &:focus,
        &.active {
            ${tw`text-gray-100 border-arix`}

            &::after {
                ${tw`opacity-100`}
            }

            & > .routers_link_icon {
                ${tw`text-arix duration-300`}
            }
        }
    }

    &.filled .routers_link {
        &::after {
            ${tw`absolute inset-0 z-[-1] opacity-0 bg-arix duration-300`}
            content: '';
        }

        &:hover,
        &:focus,
        &.active {
            ${tw`text-gray-100`}

            &:after {
                ${tw`opacity-100`}
            }

            & > .routers_link_icon {
                ${tw`text-gray-100`}
            }
        }
    }

    &.filled_secondary .routers_link {
        &::after {
            ${tw`absolute inset-0 z-[-1] opacity-0 bg-gray-500 duration-300`}
            content: '';
        }

        &:hover,
        &:focus,
        &.active {
            ${tw`text-gray-100`}

            &:after {
                ${tw`opacity-100`}
            }

            & > .routers_link_icon {
                ${tw`text-gray-100`}
            }
        }
    }

    &.icon_pill .routers_link {
        ${tw`py-2 gap-3`}

        & > .routers_link_icon {
            ${tw`relative flex items-center justify-center z-10`};

            &:after {
                ${tw`absolute w-8 h-8 duration-300 rounded-component`};
                z-index: -1;
                content: '';
            }
            & > svg {
                ${tw`relative z-10`}
            }
        }

        &:hover,
        &:focus,
        &.active {
            ${tw`text-gray-50`}

            & > .routers_link_icon {
                ${tw`text-gray-50`}

                &:after {
                    ${tw`bg-arix`}
                }
            }
        }
    }

    &.pill .routers_link {
        &::after {
            ${tw`absolute inset-0 z-[-1] mx-2 rounded-component opacity-0 bg-arix duration-300`}
            content: '';
        }

        &:hover,
        &:focus,
        &.active {
            ${tw`text-gray-100`}

            &:after {
                ${tw`opacity-100`}
            }

            & > .routers_link_icon {
                ${tw`text-gray-100`}
            }
        }
    }

    &.pill_secondary .routers_link {
        &::after {
            ${tw`absolute inset-0 z-[-1] mx-2 rounded-component opacity-0 bg-gray-500 duration-300`}
            content: '';
        }

        &:hover,
        &:focus,
        &.active {
            ${tw`text-gray-100`}

            &:after {
                ${tw`opacity-100`}
            }

            & > .routers_link_icon {
                ${tw`text-gray-100`}
            }
        }
    }
`;

export default NavigationLinks;
