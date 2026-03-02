'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '../../src/components/Navbar';
import { useAuth } from '../../src/context/AuthContext';
import { WalletDashboardBadge } from '../../src/components/WalletDashboardBadge';
import { ConnectWalletButton } from '../../src/components/ConnectWalletButton';
import { useAppKitAccount } from '@reown/appkit/react';

export default function WalletScreen() {
  const router = useRouter();
  const { isLoggedIn, isLoading } = useAuth();
  const { isConnected, address } = useAppKitAccount();
  const [showBalance, setShowBalance] = useState(true);

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
    <div className="min-h-screen bg-[#050B18] text-white selection:bg-olos-blue/30 overflow-x-hidden pb-24 md:pb-12">
      <Navbar />

      <main className="pt-32 px-4 md:px-8 max-w-[1200px] mx-auto animate-fade-in">
        <h1 className="text-4xl font-black text-olos-blue tracking-tight mb-8">Wallet</h1>

        {/* Total Balance Card */}
        <div className="bg-[#0B1121]/40 border border-white/10 rounded-[20px] p-8 mb-6 relative group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-3">Total Balance</p>
              <div className="flex items-baseline gap-2">
                <h2 className="text-3xl font-black tracking-tight">
                  {showBalance ? '12,450 GVT\'s' : '* * * *'}
                </h2>
              </div>
              <p className="text-sm font-bold text-gray-500 mt-1">
                {showBalance ? '≈ $3,112.50' : '≈ * * * *'}
              </p>
            </div>
            <button
              onClick={() => setShowBalance(!showBalance)}
              className="text-gray-500 hover:text-white transition-colors p-2"
            >
              {showBalance ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4-8-11-8-11 8-11 8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* ── WEB3 WALLET BADGE ──────────────────────────────────────────
            Shows:
            • Web3 user  → connected address + GVT balance + Stake button
            • Web2 user  → "Wallet Ready" managed badge + Stake button
        ──────────────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="bg-[#0B1121]/40 border border-white/10 rounded-[20px] p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-2">
                  {isConnected ? "Web3 Wallet Connected" : "Connect Your Wallet"}
                </p>
                {isConnected && address ? (
                  <>
                    <p className="text-sm font-mono text-white mb-1">{address.slice(0, 6)}...{address.slice(-4)}</p>
                    <p className="text-xs font-bold text-olos-blue">Ready for staking</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-400">Connect your MetaMask or WalletConnect to enable staking</p>
                )}
              </div>
              <div className="w-full md:w-auto">
                <ConnectWalletButton variant="page" />
              </div>
            </div>
          </div>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
          <SmallActionCard
            label="Rewards"
            value={showBalance ? "1,250" : "* * * *"}
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17M14 14.66V17M18 2H6v7a6 6 0 0 0 12 0V2z"/>
              </svg>
            }
          />
          <SmallActionCard
            label="NFT's"
            value={showBalance ? "7" : "* * * *"}
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            }
          />

          <button className="col-span-1 md:col-span-1 h-32 md:h-auto bg-[#3B82F6] rounded-2xl flex flex-col items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-blue-500/20 group overflow-hidden relative">
            <div className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </div>
            <span className="text-xs font-black uppercase tracking-widest">Deposit</span>
          </button>

          <button className="col-span-1 md:col-span-1 h-32 md:h-auto bg-[#3B82F6] rounded-2xl flex flex-col items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-blue-500/20 group overflow-hidden relative">
            <div className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center rotate-180">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </div>
            <span className="text-xs font-black uppercase tracking-widest">Withdraw</span>
          </button>

          <SmallActionCard
            label="History"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
            }
          />
        </div>

        {/* Recent Activity */}
        <div className="bg-[#0B1121]/40 border border-white/10 rounded-2xl p-8">
          <h2 className="text-sm font-bold uppercase tracking-widest text-white mb-8">Recent Activity</h2>
          <div className="space-y-4">
            <ActivityItem type="deposit"    label="Deposit"        time="2 min ago"   amount="+2,500" />
            <ActivityItem type="withdrawal" label="Withdrawal"     time="1 hour ago"  amount="-1,000" />
            <ActivityItem type="reward"     label="Battle Reward"  time="2 hours ago" amount="+350"   />
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-[#0B1121]/95 backdrop-blur-md border-t border-white/10 flex items-center justify-around px-6 z-[100]">
        <MobileNavItem
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/><path d="M18 12H22"/></svg>}
          label="Wallet"
          active
        />
        <MobileNavItem
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>}
          label="Deposit"
        />
        <MobileNavItem
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>}
          label="Withdraw"
          rotate
        />
      </div>
    </div>
  );
}

// Sub-components

function SmallActionCard({ label, value, icon }: { label: string; value?: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center p-6 bg-[#0B1121]/40 border border-white/10 rounded-2xl hover:border-olos-blue/30 transition-all cursor-pointer group">
      <div className="text-olos-blue mb-4 group-hover:scale-110 transition-transform">{icon}</div>
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">{label}</p>
      {value && <p className="text-sm font-black text-white">{value}</p>}
    </div>
  );
}

function ActivityItem({ type, label, time, amount }: {
  type: 'deposit' | 'withdrawal' | 'reward';
  label: string;
  time: string;
  amount: string;
}) {
  const isPositive = type === 'deposit' || type === 'reward';
  return (
    <div className="flex items-center justify-between p-5 bg-white/5 rounded-2xl hover:bg-white/[0.08] transition-all group cursor-pointer">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
          type === 'deposit'    ? 'bg-green-500/10 text-green-500' :
          type === 'withdrawal' ? 'bg-red-500/10 text-red-500' :
                                  'bg-olos-blue/10 text-olos-blue'
        }`}>
          {type === 'deposit' && (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          )}
          {type === 'withdrawal' && (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rotate-180"><path d="M12 5v14M5 12h14"/></svg>
          )}
          {type === 'reward' && (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17M14 14.66V17M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>
          )}
        </div>
        <div>
          <h4 className="text-sm font-bold text-white">{label}</h4>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">{time}</p>
        </div>
      </div>
      <div className="text-right">
        <p className={`text-sm font-black ${isPositive ? 'text-green-500' : 'text-red-500'}`}>{amount}</p>
        <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest mt-0.5">GVT's</p>
      </div>
    </div>
  );
}

function MobileNavItem({ icon, label, active, rotate }: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  rotate?: boolean;
}) {
  return (
    <button className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-olos-blue scale-110' : 'text-gray-500'}`}>
      <div className={`${rotate ? 'rotate-180' : ''}`}>{icon}</div>
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      {active && <div className="w-1 h-1 rounded-full bg-olos-blue mt-0.5 shadow-[0_0_8px_#3B82F6]" />}
    </button>
  );
}