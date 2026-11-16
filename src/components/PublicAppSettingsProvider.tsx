import { safeLogger } from '@/lib/safeLogger';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  getDefaultPublicAppSettings,
  getPublicAppSettings,
  type PublicAppSettings,
} from '@/services/appSettingsService';

type PublicAppSettingsContextValue = {
  settings: PublicAppSettings;
  loading: boolean;
  refresh: () => Promise<void>;
};

const PublicAppSettingsContext = createContext<PublicAppSettingsContextValue | null>(null);

export function PublicAppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(getDefaultPublicAppSettings);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setSettings(await getPublicAppSettings());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh().catch((error: unknown) => {
      safeLogger.warn('Public app settings are unavailable; using defaults:', error);
    });
  }, [refresh]);

  const value = useMemo(() => ({ settings, loading, refresh }), [settings, loading, refresh]);
  return <PublicAppSettingsContext.Provider value={value}>{children}</PublicAppSettingsContext.Provider>;
}

export function usePublicAppSettings() {
  const context = useContext(PublicAppSettingsContext);
  if (!context) throw new Error('usePublicAppSettings must be used within PublicAppSettingsProvider.');
  return context;
}
