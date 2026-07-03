import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from 'react';
import { apiPost } from './api-client';

type AuthUser = {
  email: string;
  id: string;
  isActive: boolean;
  name: string;
  role: string;
  supabaseUserId: string;
};

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

type AuthContextValue = {
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  user: AuthUser | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken,
      async login(email, password) {
        const response = await apiPost<
          LoginResponse,
          { email: string; password: string }
        >('/auth/login', {
          email,
          password,
        });

        setAccessToken(response.accessToken);
        setUser(response.user);
      },
      user,
    }),
    [accessToken, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
