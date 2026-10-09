import React, { createRef } from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import Fade from '@/components/elements/Fade';
import Portal from '@/components/elements/Portal';

interface Props {
    children: React.ReactNode;
    sideBar?: boolean;
    renderToggle: (onClick: (e: React.MouseEvent<any, MouseEvent>) => void) => React.ReactChild;
}

export const DropdownButtonRow = styled.button<{ danger?: boolean }>`
    ${tw`p-2 flex items-center rounded w-full text-neutral-200 gap-1`};
    transition: 150ms all ease;

    & > svg {
        ${tw`text-gray-300`}
    }

    &:hover {
        ${(props) => (props.danger ? tw`text-danger-50 bg-danger-200` : tw`text-neutral-100 bg-neutral-500`)};

        & > svg {
            ${(props) => (props.danger ? tw`text-danger-50` : tw`text-neutral-200`)};
        }
    }
`;
export const DropdownLinkRow = styled.a<{ danger?: boolean }>`
    ${tw`p-2 flex items-center rounded w-full text-neutral-200 gap-1`};
    transition: 150ms all ease;

    & > svg {
        ${tw`text-gray-300`}
    }

    &:hover {
        ${(props) => (props.danger ? tw`text-danger-50 bg-danger-200` : tw`text-neutral-100 bg-neutral-500`)};

        & > svg {
            ${(props) => (props.danger ? tw`text-danger-50` : tw`text-neutral-200`)};
        }
    }
`;
export const DropdownDivider = styled.div`
    ${tw`border-t border-neutral-500 my-2 -mx-2`};
`;

interface State {
    posX: number;
    posY: number;
    visible: boolean;
}

class DropdownMenu extends React.PureComponent<Props, State> {
    menu = createRef<HTMLDivElement>();

    state: State = {
        posX: 0,
        posY: 0,
        visible: false,
    };

    componentWillUnmount() {
        this.removeListeners();
    }

    componentDidUpdate(prevProps: Readonly<Props>, prevState: Readonly<State>) {
        const menu = this.menu.current;

        if (this.state.visible && !prevState.visible && menu) {
            document.addEventListener('click', this.windowListener);
            document.addEventListener('contextmenu', this.contextMenuListener);
            menu.style.left = `${Math.round(this.state.posX - menu.clientWidth)}px`;
            menu.style.top = `${Math.round(this.state.posY) + 10}px`;
        }

        if (!this.state.visible && prevState.visible) {
            this.removeListeners();
        }
    }

    removeListeners = () => {
        document.removeEventListener('click', this.windowListener);
        document.removeEventListener('contextmenu', this.contextMenuListener);
    };

    onClickHandler = (e: React.MouseEvent<any, MouseEvent>) => {
        e.preventDefault();
        this.triggerMenu(e.clientX, e.clientY);
    };

    contextMenuListener = () => this.setState({ visible: false });

    windowListener = (e: MouseEvent) => {
        const menu = this.menu.current;

        if (e.button === 2 || !this.state.visible || !menu) {
            return;
        }

        if (e.target === menu || menu.contains(e.target as Node)) {
            return;
        }

        if (e.target !== menu && !menu.contains(e.target as Node)) {
            this.setState({ visible: false });
        }
    };

    triggerMenu = (posX: number, posY: number) => {
        const rect = document.body.getBoundingClientRect();
        const mouseY = posY - rect.top; // Adjust for the body's position on the document

        this.setState((s) => ({
            posX: !s.visible ? posX : s.posX,
            posY: !s.visible ? mouseY : s.posY,
            visible: !s.visible,
        }));
    };

    render() {
        return (
            <div>
                {this.props.renderToggle(this.onClickHandler)}
                <Portal>
                    <Fade timeout={150} in={this.state.visible} unmountOnExit>
                        <div
                            ref={this.menu}
                            onClick={(e) => {
                                e.stopPropagation();
                                this.setState({ visible: false });
                            }}
                            style={{ width: '12rem' }}
                            className={`absolute bg-neutral-600 p-2 rounded-lg border border-neutral-500 shadow-lg text-neutral-200 z-50 ${
                                this.props.sideBar ? '!left-10 !bottom-[3rem] !top-[auto] !fixed !z-[100]' : ''
                            }`}
                        >
                            {this.props.children}
                        </div>
                    </Fade>
                </Portal>
            </div>
        );
    }
}

export default DropdownMenu;
