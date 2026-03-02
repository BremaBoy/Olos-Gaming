'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import { ConnectWalletButton } from '@/components/ConnectWalletButton';
import { useAppKitAccount } from '@reown/appkit/react';

export default function ProfileScreen() {
  const router = useRouter();
  const { isLoggedIn, user, isLoading } = useAuth();
  const { isConnected, address } = useAppKitAccount();

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.push('/auth');
    }
  }, [isLoggedIn, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050B18] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-olos-blue/30 border-t-olos-blue rounded-full animate-spin" />
      </div>
    );
  }

  if (!isLoggedIn) return null;

  return (
    <div className="min-h-screen bg-[#050B18] text-white selection:bg-olos-blue/30 overflow-x-hidden">
      <Navbar />

      <main className="pt-32 pb-20 px-4 md:px-8 max-w-[1200px] mx-auto animate-fade-in">
        {/* Profile Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-12">
          <div>
            <h1 className="text-4xl font-black tracking-tight uppercase mb-1">
              {user?.username || user?.email?.split('@')[0] || 'Player'}
            </h1>
            <p className="text-gray-500 font-bold tracking-tight">{user?.email}</p>
          </div>
          <button className="px-10 py-3.5 rounded-xl bg-[#3B82F6] hover:bg-[#2563EB] text-white text-[13px] font-black uppercase tracking-widest transition-all active:scale-[0.98] shadow-lg shadow-blue-500/20">
            Find a Match
          </button>
        </div>

        {/* Wallet Connection Section */}
        <div className="bg-[#0B1121]/40 border border-white/10 rounded-2xl p-8 mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-[#3B82F6] mb-2">Web3 Wallet</h2>
              <p className="text-gray-400 text-sm">
                {isConnected 
                  ? "Your wallet is connected and ready for staking" 
                  : "Connect your wallet to enable staking and blockchain features"}
              </p>
              {isConnected && address && (
                <p className="text-xs text-gray-500 mt-2 font-mono">
                  {address.slice(0, 6)}...{address.slice(-4)}
                </p>
              )}
            </div>
            <div className="w-full md:w-auto">
              <ConnectWalletButton variant="page" />
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <StatCard 
            label="Balance" 
            value="1000 GVT" 
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/><path d="M18 12H22"/></svg>}
          />
          <StatCard 
            label="Win Rate" 
            value="0%" 
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>}
          />
          <StatCard 
            label="Total Matches" 
            value="0" 
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
          />
          <StatCard 
            label="Current Streak" 
            value="0🔥" 
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 14 4-4 4 4-4 4Z"/><path d="m3.34 7 4-4 4 4-4 4Z"/><path d="m7.84 14 4-4 4 4-4 4Z"/><path d="m14.5 17 4-4 4 4-4 4Z"/></svg>}
          />
        </div>

        {/* Performance Section */}
        <div className="bg-[#0B1121]/40 border border-white/10 rounded-2xl p-8 mb-8">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[#3B82F6] mb-8">Performance</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <PerfItem label="Wins" value="8" color="text-green-500" />
            <PerfItem label="Losses" value="0" color="text-red-500" />
            <PerfItem label="Best Streak" value="0" />
            <PerfItem label="Total Earnings" value="+0" color="text-green-500" suffix="GVT's" />
          </div>
        </div>

        {/* Match History */}
        <div className="bg-[#0B1121]/40 border border-white/10 rounded-2xl p-8">
          <h2 className="text-sm font-bold uppercase tracking-widest text-white/50 mb-12">Match History</h2>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-gray-500 font-bold text-sm">No matches played yet. Start competing to see your history</p>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-[#0B1121]/40 border border-white/10 rounded-2xl p-6 flex items-center gap-6 group hover:border-[#3B82F6]/30 transition-all">
      <div className="w-12 h-12 rounded-xl bg-[#1A232E] border border-white/5 flex items-center justify-center text-olos-blue group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-xl font-black text-white uppercase tracking-tight">{value}</p>
      </div>
    </div>
  );
}

function PerfItem({ label, value, color = "text-white", suffix }: { label: string; value: string; color?: string; suffix?: string }) {
  return (
    <div className="space-y-1">
       <p className={`text-2xl font-black ${color}`}>{value}</p>
       <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">
         {label}
         {suffix && <span className="block mt-1 text-gray-600">{suffix}</span>}
       </p>
    </div>
  );
}
