"use client";

import { useAppKitAccount } from "@reown/appkit/react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function WalletDashboardBadge() {
  const { isConnected, address } = useAppKitAccount();
  const { isLoggedIn, user } = useAuth();

  // ── Web3 user: connected external wallet ──────────────────────────
  if (isConnected && address) {
    return (
      <div className="bg-[#0B1121] border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
            Connected Wallet
          </h3>
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Active
          </span>
        </div>

        <div className="flex items-center gap-3 mb-5">
          {/* Wallet avatar */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" />
              <path d="M18 12H22" />
            </svg>
          </div>
          <div>
            <p className="text-white font-black text-[15px] tracking-tight">
              {shortenAddress(address)}
            </p>
            <p className="text-gray-500 text-[11px] font-medium">External Wallet · Polygon</p>
          </div>
        </div>

        {/* GVT Balance placeholder */}
        <div className="bg-white/3 border border-white/8 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">GVT Balance</p>
              <p className="text-2xl font-black text-white">0.00</p>
            </div>
            <div className="text-olos-blue">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
          </div>
        </div>

        {/* Staking CTA */}
        <Link
          href="/stake"
          className="flex items-center justify-center gap-2 w-full py-3 bg-olos-blue hover:bg-olos-cobalt rounded-xl text-white text-[13px] font-bold transition-all active:scale-95"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          Stake GVT Tokens
        </Link>
      </div>
    );
  }

  // ── Web2 user: embedded wallet (created by backend) ───────────────
  if (isLoggedIn) {
    return (
      <div className="bg-[#0B1121] border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
            Your Wallet
          </h3>
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-blue-400">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Managed
          </span>
        </div>

        {/* Embedded wallet info */}
        <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4 mb-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center shrink-0 mt-0.5">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <p className="text-white text-[13px] font-bold mb-1">Wallet Ready</p>
              <p className="text-gray-400 text-xs leading-relaxed">
                Your OLOS wallet is set up and ready. No seed phrases needed — we handle the crypto so you can focus on playing.
              </p>
            </div>
          </div>
        </div>

        {/* GVT Balance */}
        <div className="bg-white/3 border border-white/8 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">GVT Balance</p>
              <p className="text-2xl font-black text-white">1,000.00</p>
            </div>
            <div className="text-olos-blue">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
          </div>
        </div>

        {/* Staking CTA */}
        <Link
          href="/stake"
          className="flex items-center justify-center gap-2 w-full py-3 bg-olos-blue hover:bg-olos-cobalt rounded-xl text-white text-[13px] font-bold transition-all active:scale-95 mb-3"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          Start Staking
        </Link>

        {/* Upgrade to self-custody */}
        <button className="w-full py-2.5 text-[12px] font-bold text-gray-500 hover:text-gray-300 transition-colors border border-white/5 rounded-xl hover:border-white/10">
          Connect your own wallet instead →
        </button>
      </div>
    );
  }

  return null;
}