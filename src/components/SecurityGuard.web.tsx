import { createContext, useContext, type ReactNode } from 'react';

type SecurityContextValue = {
  appLockEnabled: false;
  setAppLockEnabled: (enabled: boolean) => Promise<void>;
};
const SecurityContext = createContext<SecurityContextValue | null>(null);

export function SecurityGuard({ children }: { children: ReactNode }) {
  return (
    <SecurityContext.Provider value={{ appLockEnabled: false, setAppLockEnabled: async () => undefined }}>
      {children}
    </SecurityContext.Provider>
  );
}

export function useSecuritySettings() {
  const context = useContext(SecurityContext);
  if (!context) throw new Error('useSecuritySettings must be used within SecurityGuard.');
  return context;
}
