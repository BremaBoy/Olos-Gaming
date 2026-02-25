'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';

interface WalletContextType {
  balance: number;
  isLoading: boolean;
  refreshBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBalance = async (userId: string) => {
    if (!userId) return;
    setIsLoading(true);
    console.log('[WalletContext] Fetching balance for:', userId);
    
    try {
      // Verify session state
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        console.warn('[WalletContext] No active session found when fetching balance');
      }

      const { data, error } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.warn('[WalletContext] Wallet missing, attempting to create...');
          const { data: newData, error: insertError } = await supabase
            .from('wallets')
            .insert({ user_id: userId })
            .select()
            .single();
          
          if (insertError) {
            // Handle race condition: wallet created by another process/tab
            if (insertError.code === '23505') {
              console.log('[WalletContext] Wallet was created concurrently, re-fetching...');
              return fetchBalance(userId);
            }

            console.error('[WalletContext] Error creating wallet. Code:', insertError.code);
            console.error('[WalletContext] Error Message:', insertError.message);
            console.error('[WalletContext] Error Details:', insertError.details);
            throw insertError;
          }
          if (newData) {
            console.log('[WalletContext] Wallet created successfully:', newData.balance);
            setBalance(Number(newData.balance));
          }
        } else {
          console.error('[WalletContext] Supabase fetch error. Code:', error.code);
          console.error('[WalletContext] Message:', error.message);
          throw error;
        }
      } else if (data) {
        console.log('[WalletContext] Balance fetched:', data.balance);
        setBalance(Number(data.balance));
      }
    } catch (err: any) {
      console.error('[WalletContext] Detailed error catch:', {
        message: err.message,
        code: err.code,
        fullError: String(err)
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Wait for auth context to determine if user is logged in
    if (authLoading) return;

    if (!user) {
      setBalance(0);
      setIsLoading(false);
      return;
    }

    fetchBalance(user.id);

    // Subscribe to real-time updates for THIS user's wallet
    const channel = supabase
      .channel(`wallet:${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'wallets',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        console.log('Wallet update received:', payload.new.balance);
        setBalance(Number(payload.new.balance));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, authLoading]);

  return (
    <WalletContext.Provider value={{ 
      balance, 
      isLoading,
      refreshBalance: () => user ? fetchBalance(user.id) : Promise.resolve()
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
