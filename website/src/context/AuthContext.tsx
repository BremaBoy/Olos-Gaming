'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  fullName?: string;
  username?: string;
}

interface AuthContextType {
  user: User | null;
  session: any | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (data: { user: User; session: any }) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for saved session on mount
    const savedUser = localStorage.getItem('olos_user');
    const savedSession = localStorage.getItem('olos_session');

    if (savedUser && savedSession) {
      try {
        setUser(JSON.parse(savedUser));
        setSession(JSON.parse(savedSession));
      } catch (e) {
        console.error('Failed to parse saved auth state', e);
        localStorage.removeItem('olos_user');
        localStorage.removeItem('olos_session');
      }
    }
    setIsLoading(false);
  }, []);

  const login = (data: { user: User; session: any }) => {
    setUser(data.user);
    setSession(data.session);
    localStorage.setItem('olos_user', JSON.stringify(data.user));
    localStorage.setItem('olos_session', JSON.stringify(data.session));
  };

  const logout = () => {
    setUser(null);
    setSession(null);
    localStorage.removeItem('olos_user');
    localStorage.removeItem('olos_session');
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      isLoggedIn: !!user, 
      isLoading,
      login,
      logout
    }}>
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
