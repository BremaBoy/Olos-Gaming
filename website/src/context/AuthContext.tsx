'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useDisconnect, useAppKitAccount } from "@reown/appkit/react";

interface User {
  id: string;
  email: string;
  fullName?: string;
  username?: string;
  walletAddress?: string;
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
  const { disconnect } = useDisconnect();
  const { address, isConnected } = useAppKitAccount();

  useEffect(() => {
    // Check for saved session on mount
    const savedUser = localStorage.getItem('olos_user');
    const savedSession = localStorage.getItem('olos_session');

    const initAuth = async () => {
      // Get current session from Supabase SDK
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (currentSession) {
        // Double check validity with getUser()
        const { data: { user: verifiedUser }, error } = await supabase.auth.getUser();
        
        if (!error && verifiedUser) {
          console.log('[AuthContext] Session verified for:', verifiedUser.email);
          
          // Fetch additional profile data (especially wallet_address)
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('wallet_address, full_name, username')
            .eq('id', verifiedUser.id)
            .maybeSingle();

          if (profileError) {
            console.error('[AuthContext] Error fetching profile:', {
              message: profileError.message,
              code: profileError.code,
              details: profileError.details,
              hint: profileError.hint
            });
          }
          
          setUser({
            id: verifiedUser.id,
            email: verifiedUser.email!,
            fullName: profile?.full_name || verifiedUser.user_metadata?.full_name,
            username: profile?.username || verifiedUser.user_metadata?.username,
            walletAddress: profile?.wallet_address
          });
          setSession(currentSession);
          setIsLoading(false);
          return;
        }
      }

      // If we reach here, session is missing or invalid
      // Check if we HAD a saved user to decide if we need to purge
      if (savedUser || savedSession) {
        console.warn('[AuthContext] Session invalid or expired. Purging state...');
        localStorage.removeItem('olos_user');
        localStorage.removeItem('olos_session');
        
        // Disconnect Web3 wallet on session expiry for security
        try {
          disconnect();
        } catch (e) {
          console.error('[AuthContext] Error disconnecting Web3 wallet on expiry:', e);
        }

        try {
          await supabase.auth.signOut();
        } catch (e) {}
      }
      
      setUser(null);
      setSession(null);
      setIsLoading(false);
    };

    initAuth();
  }, []);

  // Sync wallet address to Supabase profile when connected
  useEffect(() => {
    if (!!user && isConnected && address) {
      if (user.walletAddress !== address) {
        console.log('[AuthContext] Syncing wallet address to profile:', address);
        
        const syncWallet = async () => {
          if (!user?.id || !address) return;

          console.log('[AuthContext] Attempting to sync wallet address:', {
            userId: user.id,
            address: address
          });

          // Use upsert to handle cases where the profile record might be missing
          const { error } = await supabase
            .from('profiles')
            .upsert({ 
              id: user.id, 
              wallet_address: address,
              updated_at: new Date().toISOString()
            }, { 
              onConflict: 'id' 
            });
          
          if (error) {
            console.error('[AuthContext] Error syncing wallet address:', {
              message: error.message,
              code: error.code,
              details: error.details,
              hint: error.hint,
              fullError: error
            });
          } else {
            console.log('[AuthContext] Wallet address synced successfully');
            // Update local user state
            setUser(prev => prev ? { ...prev, walletAddress: address } : null);
            // Also update localStorage
            const updatedUser = { ...user, walletAddress: address };
            localStorage.setItem('olos_user', JSON.stringify(updatedUser));
          }
        };

        syncWallet();
      }
    }
  }, [user, isConnected, address]);

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
    try {
      // Call Supabase signOut first while session is still in memory/local storage
      // This ensures the client knows which session to end.
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('[AuthContext] Supabase signOut error:', error);
      }
    } catch (e) {
      // Catch network errors (like "Failed to fetch") or other exceptions
      console.error('[AuthContext] Exception during signOut fetch:', e);
    }

    // Always clear local state even if the network request failed
    setUser(null);
    setSession(null);
    localStorage.removeItem('olos_user');
    localStorage.removeItem('olos_session');
    
    // Auto-disconnect Web3 wallet for security
    try {
      await disconnect();
    } catch (e) {
      console.error('[AuthContext] Error disconnecting Web3 wallet:', e);
    }
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
