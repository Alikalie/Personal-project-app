import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  getDefaultPublicAppSettings,
  getPublicAppSettings,
  type PublicAppSettings,
} from '@/services/appSettingsService';

type PublicAppSettingsContextValue = {
  settings: PublicAppSettings;
  refresh: () => Promise<void>;
};

const PublicAppSettingsContext = createContext<PublicAppSettingsContextValue | null>(null);

export function PublicAppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(getDefaultPublicAppSettings);

  const refresh = useCallback(async () => {
    setSettings(await getPublicAppSettings());
  }, []);

  useEffect(() => {
    void refresh().catch((error: unknown) => {
      console.warn('Public app settings are unavailable; using defaults:', error);
    });
  }, [refresh]);

  const value = useMemo(() => ({ settings, refresh }), [settings, refresh]);
  return <PublicAppSettingsContext.Provider value={value}>{children}</PublicAppSettingsContext.Provider>;
}

export function usePublicAppSettings() {
  const context = useContext(PublicAppSettingsContext);
  if (!context) throw new Error('usePublicAppSettings must be used within PublicAppSettingsProvider.');
  return context;
}
