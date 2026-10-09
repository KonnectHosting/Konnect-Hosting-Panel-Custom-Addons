import React, { createContext, useContext, useState } from 'react';

const FloatingContext = createContext<{
    floating: boolean;
    setFloating: (v: boolean) => void;
}>({
    floating: false,
    setFloating: () => undefined,
});

export const FloatingProvider: React.FC = ({ children }) => {
    const [floating, setFloating] = useState(false);
    // 6516e7b4aff8d132a2791d02eb348e11e46477a33b08eecef1279f736935fb3c

    return <FloatingContext.Provider value={{ floating, setFloating }}>{children}</FloatingContext.Provider>;
};

export const useFloating = () => useContext(FloatingContext);
