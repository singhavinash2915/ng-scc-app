import type { ReactNode } from 'react';
import { createContext, useContext, useState } from 'react';
import { verifyAdminPassword } from '../lib/supabase';

interface AuthContextType {
  isAdmin: boolean;
  loginLoading: boolean;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return localStorage.getItem('scc-admin') === 'true';
  });
  const [loginLoading, setLoginLoading] = useState(false);

  const login = async (password: string): Promise<boolean> => {
    setLoginLoading(true);
    try {
      const isValid = await verifyAdminPassword(password);
      if (isValid) {
        setIsAdmin(true);
        localStorage.setItem('scc-admin', 'true');
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setLoginLoading(false);
    }
  };

  const logout = () => {
    setIsAdmin(false);
    localStorage.removeItem('scc-admin');
  };

  return (
    <AuthContext.Provider value={{ isAdmin, loginLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
