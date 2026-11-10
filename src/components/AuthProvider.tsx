import { createContext, useContext, useState, type ReactNode } from 'react';

export type AuthUser = {
  name: string;
  email: string;
  phone?: string;
};

export type AuthContextValue = {
  loading: boolean;
  ctx: AuthUser | null;
  signIn: (email: string) => void;
  signUp: (user: AuthUser) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ctx, setCtx] = useState<AuthUser | null>(null);

  const signIn = (email: string) => setCtx({ name: '', email });
  const signUp = (user: AuthUser) => setCtx(user);

  return (
    <AuthContext.Provider value={{ loading: false, ctx, signIn, signUp }}>
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
