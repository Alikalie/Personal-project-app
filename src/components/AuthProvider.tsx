import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';

import { friendlyErrorMessage } from '@/lib/errors';
import { loadAuthUser, signInWithPassword, signUpWithPassword } from '@/services/authService';
import { supabase } from '@/lib/supabase';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  profileCode: string | null;
  businessId: string | null;
  businessName: string | null;
  businessCode: string | null;
  platformAdminLevel: string | null;
  business: {
    id: string;
    name: string | null;
    role: string | null;
    businessCode: string | null;
    businessType: string | null;
    address: string | null;
    district: string | null;
    phone: string | null;
    createdAt: string | null;
    logoPath: string | null;
    receiptHeader: string | null;
    receiptFooter: string | null;
    showLogoOnReceipt: boolean;
    notifyLowStock: boolean;
    currencyCode: string | null;
  } | null;
};

export type AuthContextValue = {
  loading: boolean;
  error: string | null;
  ctx: AuthUser | null;
  refresh: () => Promise<AuthUser | null>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (user: Omit<AuthUser, 'id' | 'businessId' | 'businessName' | 'business'>, password: string) => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ctx, setCtx] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!data.session) {
        setCtx(null);
        return null;
      }

      const user = await loadAuthUser(data.session.user);
      setCtx(user);
      return user;
    } catch (refreshError) {
      const message = friendlyErrorMessage(refreshError);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithPassword(email, password);
  }, []);

  const signUp = useCallback(async (
    user: Omit<AuthUser, 'id' | 'businessId' | 'businessName' | 'business'>,
    password: string,
  ) => signUpWithPassword(user, password), []);

  useEffect(() => {
    let active = true;
    const subscription = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session) {
        setCtx(null);
        setLoading(false);
        setError(null);
        return;
      }
      setCtx({
        id: session.user.id,
        name: String(session.user.user_metadata.full_name ?? ''),
        email: session.user.email ?? '',
        phone: typeof session.user.user_metadata.phone === 'string'
          ? session.user.user_metadata.phone
          : undefined,
        profileCode: null,
        businessId: null,
        businessName: null,
        businessCode: null,
        platformAdminLevel: null,
        business: null,
      });
      setLoading(true);
      setTimeout(() => {
        if (active) void refresh().catch(() => undefined);
      }, 0);
    }).data.subscription;

    void refresh().catch(() => undefined);
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ loading, error, ctx, refresh, signIn, signUp }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }
  return context;
}
