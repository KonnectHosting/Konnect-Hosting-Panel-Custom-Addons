import React from 'react';
import tw from 'twin.macro';
import styled from 'styled-components/macro';
import CSSTransition, { CSSTransitionProps } from 'react-transition-group/CSSTransition';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';

interface Props extends Omit<CSSTransitionProps, 'timeout' | 'classNames'> {
    timeout: number;
}

const Container = styled.div<{ timeout: number }>`
    .fade-enter,
    .fade-exit,
    .fade-appear,
    .fadeUp-enter,
    .fadeUp-exit,
    .fadeUp-appear,
    .fadeScale-enter,
    .fadeScale-exit,
    .fadeScale-appear {
        will-change: opacity, transform;
    }

    .fade-enter,
    .fade-appear {
        ${tw`opacity-0`};

        &.fade-enter-active,
        &.fade-appear-active {
            ${tw`opacity-100 transition-opacity ease-in`};
            transition-duration: ${(props) => props.timeout}ms;
        }
    }

    .fade-exit {
        ${tw`opacity-100`};

        &.fade-exit-active {
            ${tw`opacity-0 transition-opacity ease-in`};
            transition-duration: ${(props) => props.timeout}ms;
        }
    }

    .fadeUp-enter,
    .fadeUp-appear {
        ${tw`opacity-0`};
        transform: translateY(10px);

        &.fadeUp-enter-active,
        &.fadeUp-appear-active {
            ${tw`opacity-100 ease-in`};
            transform: translateY(0);
            transition: opacity ${(props) => props.timeout}ms, transform ${(props) => props.timeout}ms;
        }
    }

    .fadeUp-exit {
        ${tw`opacity-100`};
        transform: translateY(0);

        &.fadeUp-exit-active {
            ${tw`opacity-0 ease-in`};
            transform: translateY(10px);
            transition: opacity ${(props) => props.timeout}ms, transform ${(props) => props.timeout}ms;
        }
    }

    .fadeScale-enter,
    .fadeScale-appear {
        ${tw`opacity-0`};
        transform: scale(0.97);

        &.fadeScale-enter-active,
        &.fadeScale-appear-active {
            ${tw`opacity-100 ease-in`};
            transform: scale(1);
            transition: opacity ${(props) => props.timeout}ms, transform ${(props) => props.timeout}ms;
        }
    }

    .fadeScale-exit {
        ${tw`opacity-100`};
        transform: scale(1);

        &.fadeScale-exit-active {
            ${tw`opacity-0 ease-in`};
            transform: scale(0.97);
            transition: opacity ${(props) => props.timeout}ms, transform ${(props) => props.timeout}ms;
        }
    }
`;

const Fade: React.FC<Props> = ({ timeout, children, ...props }) => {
    const pageTransition = useStoreState((state: ApplicationStore) => state.settings.data!.arix.styling.pageTransition);

    return (
        <Container timeout={timeout}>
            <CSSTransition
                timeout={timeout}
                classNames={
                    pageTransition === 'fadeUp' ? 'fadeUp' : pageTransition === 'fadeScale' ? 'fadeScale' : 'fade'
                }
                {...props}
            >
                {children}
            </CSSTransition>
        </Container>
    );
};
Fade.displayName = 'Fade';

export default Fade;
