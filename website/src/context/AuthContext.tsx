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
  needsUsername: boolean;
  login: (data: { user: User; session: any }) => void;
  logout: () => void;
  completeUsername: (username: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsUsername, setNeedsUsername] = useState(false);
  const { disconnect } = useDisconnect();
  const { address, isConnected } = useAppKitAccount();

  useEffect(() => {
    const savedUser = localStorage.getItem('olos_user');
    const savedSession = localStorage.getItem('olos_session');

    // Helper: given a verified Supabase user + session, load/upsert profile and set state
    const applySession = async (verifiedUser: any, currentSession: any) => {
      console.log('[AuthContext] Applying session for:', verifiedUser.email);

      // Fetch existing profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('wallet_address, full_name, username')
        .eq('id', verifiedUser.id)
        .maybeSingle();

      if (profileError) {
        console.error('[AuthContext] Error fetching profile:', profileError.message);
      }

      // For OAuth users (Google etc.), upsert profile if it doesn't exist yet
      const isOAuthUser = !!verifiedUser.app_metadata?.provider && verifiedUser.app_metadata.provider !== 'email';
      if (isOAuthUser && !profile) {
        // Insert without a username — user will be prompted via the modal
        const { error: upsertError } = await supabase
          .from('profiles')
          .upsert({
            id: verifiedUser.id,
            full_name: verifiedUser.user_metadata?.full_name || verifiedUser.user_metadata?.name || '',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });

        if (upsertError) {
          console.error('[AuthContext] OAuth profile upsert error:', upsertError.message);
        } else {
          console.log('[AuthContext] OAuth profile upserted (no username yet)');
        }
      }

      // Flag if the user still has no username so the modal can prompt them
      const resolvedUsername = profile?.username || null;
      const missingUsername = isOAuthUser && !resolvedUsername;

      const userData: User = {
        id: verifiedUser.id,
        email: verifiedUser.email!,
        fullName: profile?.full_name || verifiedUser.user_metadata?.full_name || verifiedUser.user_metadata?.name,
        username: profile?.username || undefined,
        walletAddress: profile?.wallet_address,
      };

      setUser(userData);
      setSession(currentSession);
      setNeedsUsername(missingUsername ?? false);
      localStorage.setItem('olos_user', JSON.stringify(userData));
      localStorage.setItem('olos_session', JSON.stringify(currentSession));
      setIsLoading(false);
    };

    const initAuth = async () => {
      try {
        // Get current session from Supabase SDK
        const { data: { session: currentSession } } = await supabase.auth.getSession();

        if (currentSession) {
          const { data: { user: verifiedUser }, error } = await supabase.auth.getUser();

          if (!error && verifiedUser) {
            await applySession(verifiedUser, currentSession);
            return;
          }
        }

        // Session missing or invalid — purge stale state
        if (savedUser || savedSession) {
          console.warn('[AuthContext] Session invalid or expired. Purging state...');
          localStorage.removeItem('olos_user');
          localStorage.removeItem('olos_session');
          try { disconnect(); } catch (e) { console.error('[AuthContext] disconnect error:', e); }
          try { await supabase.auth.signOut(); } catch (e) { console.error('[AuthContext] signOut during init error:', e); }
        }

        setUser(null);
        setSession(null);
      } catch (err: any) {
        // Network or auth SDK errors (e.g. "Failed to fetch") can happen in dev or when Supabase URL is unreachable.
        console.error('[AuthContext] initAuth error:', err?.message || err);
        // Keep previous state if present; mark loading false so UI can render a non-blocking state
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Listen for auth state changes (handles OAuth redirects automatically)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('[AuthContext] Auth event:', event);
      try {
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && newSession) {
          // Try to get user, but guard against network failures
          const { data: { user: verifiedUser }, error } = await supabase.auth.getUser();
          if (!error && verifiedUser) {
            await applySession(verifiedUser, newSession);
          } else if (error) {
            console.error('[AuthContext] getUser after auth event error:', error);
          }
        }

        if (event === 'SIGNED_OUT') {
          setUser(null);
          setSession(null);
          localStorage.removeItem('olos_user');
          localStorage.removeItem('olos_session');
        }
      } catch (err: any) {
        console.error('[AuthContext] onAuthStateChange handler error:', err?.message || err);
      }
    });

    return () => subscription.unsubscribe();
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

  const completeUsername = (username: string) => {
    setNeedsUsername(false);
    setUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, username };
      localStorage.setItem('olos_user', JSON.stringify(updated));
      return updated;
    });
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
      needsUsername,
      login,
      logout,
      completeUsername,
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
