'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface HeaderActions {
  onOpenJoin?: () => void;
  onOpenCreate?: () => void;
}

interface HeaderActionsContextType {
  actions: HeaderActions;
  registerActions: (actions: HeaderActions) => void;
  clearActions: () => void;
}

const HeaderActionsContext = createContext<HeaderActionsContextType>({
  actions: {},
  registerActions: () => {},
  clearActions: () => {},
});

export function HeaderActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<HeaderActions>({});

  const registerActions = useCallback((newActions: HeaderActions) => {
    setActions(newActions);
  }, []);

  const clearActions = useCallback(() => {
    setActions({});
  }, []);

  return (
    <HeaderActionsContext.Provider value={{ actions, registerActions, clearActions }}>
      {children}
    </HeaderActionsContext.Provider>
  );
}

export function useHeaderActions() {
  return useContext(HeaderActionsContext);
}
