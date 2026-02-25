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
  const { user } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBalance = async (userId: string) => {
    setIsLoading(true);
    console.log('[WalletContext] Fetching balance for:', userId);
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.warn('[WalletContext] Wallet missing, creating one...');
          const { data: newData, error: insertError } = await supabase
            .from('wallets')
            .insert({ user_id: userId })
            .select()
            .single();
          if (insertError) throw insertError;
          if (newData) setBalance(Number(newData.balance));
        } else {
          throw error;
        }
      } else if (data) {
        console.log('[WalletContext] Balance fetched:', data.balance);
        setBalance(Number(data.balance));
      }
    } catch (error) {
      console.error('[WalletContext] Error fetching balance:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
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
  }, [user]);

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
