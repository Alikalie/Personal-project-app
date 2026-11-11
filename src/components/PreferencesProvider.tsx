import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { setMoneyDisplayPreference } from '@/lib/money';

const keys = {
  decimals: '@salonebiz/preferences/show-decimals',
  dailySummary: '@salonebiz/preferences/daily-sales-summary',
  creditReminders: '@salonebiz/preferences/credit-reminders',
} as const;

type PreferenceKey = keyof typeof keys;
type Preferences = Record<PreferenceKey, boolean>;

type PreferencesContextValue = Preferences & {
  ready: boolean;
  setPreference: (key: PreferenceKey, value: boolean) => Promise<void>;
};

const defaults: Preferences = { decimals: false, dailySummary: false, creditReminders: false };
const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [values, setValues] = useState(defaults);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.multiGet(Object.values(keys)).then((stored) => {
      if (!active) return;
      const byKey = new Map(stored);
      setValues({
        decimals: byKey.get(keys.decimals) === 'true',
        dailySummary: byKey.get(keys.dailySummary) === 'true',
        creditReminders: byKey.get(keys.creditReminders) === 'true',
      });
      setReady(true);
    }).catch((error: unknown) => {
      console.warn('Unable to load display preferences', error);
      if (active) setReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setMoneyDisplayPreference(values.decimals);
  }, [values.decimals]);

  const setPreference = useCallback(async (key: PreferenceKey, value: boolean) => {
    await AsyncStorage.setItem(keys[key], String(value));
    setValues((current) => ({ ...current, [key]: value }));
  }, []);

  const contextValue = useMemo(() => ({ ...values, ready, setPreference }), [values, ready, setPreference]);
  return <PreferencesContext.Provider value={contextValue}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used within PreferencesProvider.');
  return context;
}
