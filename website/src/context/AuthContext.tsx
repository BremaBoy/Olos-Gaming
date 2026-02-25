'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

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

    const initAuth = async () => {
      if (savedUser && savedSession) {
        try {
          const parsedUser = JSON.parse(savedUser);
          const parsedSession = JSON.parse(savedSession);
          
          // Sync with Supabase client
          if (parsedSession.access_token && parsedSession.refresh_token) {
            await supabase.auth.setSession({
              access_token: parsedSession.access_token,
              refresh_token: parsedSession.refresh_token
            });
          }

          setUser(parsedUser);
          setSession(parsedSession);
        } catch (e) {
          console.error('Failed to parse saved auth state', e);
          localStorage.removeItem('olos_user');
          localStorage.removeItem('olos_session');
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (data: { user: User; session: any }) => {
    setUser(data.user);
    setSession(data.session);
    localStorage.setItem('olos_user', JSON.stringify(data.user));
    localStorage.setItem('olos_session', JSON.stringify(data.session));

    // Sync with Supabase client
    if (data.session.access_token && data.session.refresh_token) {
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
      });
    }
  };

  const logout = async () => {
    setUser(null);
    setSession(null);
    localStorage.removeItem('olos_user');
    localStorage.removeItem('olos_session');
    await supabase.auth.signOut();
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
