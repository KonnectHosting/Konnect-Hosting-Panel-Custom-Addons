import React from 'react';
import { Redirect, Route, RouteProps } from 'react-router';
import { useStoreState } from '@/state/hooks';

type AuthenticatedRouteProps = Omit<RouteProps, 'render'> & {
    isAdmin?: boolean;
};

export default ({ children, isAdmin = false, ...props }: AuthenticatedRouteProps) => {
    const isAuthenticated = useStoreState((state) => !!state.user.data?.uuid);
    const isUserAdmin = useStoreState((state) => state.user.data?.rootAdmin);

    return (
        <Route
            {...props}
            render={({ location }) =>
                isAuthenticated ? (
                    isAdmin && !isUserAdmin ? (
                        <Redirect to={{ pathname: '/', state: { from: location } }} />
                    ) : (
                        children
                    )
                ) : (
                    <Redirect to={{ pathname: '/auth/login', state: { from: location } }} />
                )
            }
        />
    );
};
