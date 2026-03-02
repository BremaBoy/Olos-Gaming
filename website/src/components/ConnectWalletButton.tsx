"use client";

import { useAppKit, useAppKitAccount, useDisconnect } from "@reown/appkit/react";

function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

interface ConnectWalletButtonProps {
  variant?: "navbar" | "page"; // navbar = compact pill, page = full width
}

export function ConnectWalletButton({ variant = "navbar" }: ConnectWalletButtonProps) {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { disconnect } = useDisconnect();

  // ── CONNECTED STATE ──────────────────────────────────────────────
  if (isConnected && address) {
    if (variant === "page") {
      return (
        <div className="flex flex-col items-center gap-3 w-full">
          <div className="flex items-center gap-2 px-5 py-3 bg-green-500/10 border border-green-500/30 rounded-xl w-full justify-center">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm font-bold text-green-400">Wallet Connected</span>
          </div>
          <button
            onClick={() => open({ view: "Account" })}
            className="w-full px-5 py-3 bg-[#1A232E]/50 border border-white/10 rounded-xl hover:border-white/20 transition-all text-sm font-bold text-white text-center"
          >
            {shortenAddress(address)}
          </button>
          <button
            onClick={() => disconnect()}
            className="text-xs text-gray-500 hover:text-red-400 transition-colors"
          >
            Disconnect wallet
          </button>
        </div>
      );
    }

    // navbar variant
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => open({ view: "Account" })}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#1A232E]/50 border border-green-500/30 rounded-xl hover:border-green-500/50 transition-all"
        >
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
          <span className="text-[13px] font-black tracking-tight text-white">
            {shortenAddress(address)}
          </span>
        </button>
        <button
          onClick={() => disconnect()}
          title="Disconnect wallet"
          className="p-2.5 bg-[#1A232E]/50 border border-white/10 rounded-xl hover:border-red-500/40 hover:text-red-400 text-gray-400 transition-all"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    );
  }

  // ── DISCONNECTED STATE ───────────────────────────────────────────
  if (variant === "page") {
    return (
      <button
        onClick={() => open()}
        className="w-full flex items-center justify-center gap-3 px-5 py-4 bg-olos-blue hover:bg-olos-cobalt rounded-xl text-white font-bold text-[15px] transition-all active:scale-95 shadow-lg shadow-blue-900/30"
      >
        {/* Wallet icon */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" />
          <path d="M18 12H22" />
          <circle cx="19" cy="12" r="1" />
        </svg>
        Connect Wallet
        <span className="ml-auto flex items-center gap-1">
          {/* MetaMask fox hint */}
          <span className="text-[11px] font-normal text-blue-200 opacity-70">MetaMask · WalletConnect</span>
        </span>
      </button>
    );
  }

  // navbar variant disconnected
  return (
    <button
      onClick={() => open()}
      className="flex items-center gap-2 px-4 py-2.5 bg-[#1A232E]/50 border border-white/10 rounded-xl hover:border-white/20 text-[13px] font-bold text-gray-300 hover:text-white transition-all"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" />
        <path d="M18 12H22" />
      </svg>
      Connect Wallet
    </button>
  );
}