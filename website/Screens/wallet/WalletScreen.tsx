'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ethers } from 'ethers';
import Navbar from '../../src/components/Navbar';
import { useAuth } from '../../src/context/AuthContext';
import { useWallet } from '../../src/context/WalletContext';
import { ConnectWalletButton } from '../../src/components/ConnectWalletButton';
import { useAppKitAccount, useAppKitNetwork } from '@reown/appkit/react';
import { networks } from '../../src/lib/wagmi';

// ─── Constants ────────────────────────────────────────────────────────────────
const GVT_ADDRESS       = '0xDE0Bd309CbCaf5E6fBc7e05660E7BCb83520C3fC';
const ESCROW_ADDRESS    = '0xb13Cf72a4c1C2Da55e2C42E27E8Bd859C9f2A800';
const SEPOLIA_CHAIN_ID  = 11155111;
const ETHERSCAN_API_KEY = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || '';

const GVT_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

// ─── Types ────────────────────────────────────────────────────────────────────
type TxStatus = 'idle' | 'approving' | 'sending' | 'success' | 'error';

interface TxItem {
  hash:      string;
  type:      'deposit' | 'withdrawal' | 'reward' | 'other';
  label:     string;
  amount:    string;
  time:      string;
  isPositive: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(unixTs: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixTs;
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function classifyTx(tx: any, address: string): TxItem {
  const addr   = address.toLowerCase();
  const from   = (tx.from  || '').toLowerCase();
  const to     = (tx.to    || '').toLowerCase();
  const value  = parseFloat(ethers.formatEther(tx.value || '0'));
  const isIn   = to === addr;
  const isOut  = from === addr;

  // GVT token transfer (ERC20) — tx.value is 0, use tokenDecimalValue if present
  const tokenVal = tx.tokenDecimal
    ? parseFloat(tx.value) / Math.pow(10, parseInt(tx.tokenDecimal))
    : value;

  const amountStr = tokenVal > 0
    ? `${isIn ? '+' : '-'}${tokenVal.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
    : isOut ? '-ETH' : '+ETH';

  let type: TxItem['type'] = 'other';
  let label = isIn ? 'Received' : 'Sent';

  if (to === ESCROW_ADDRESS.toLowerCase())   { type = 'deposit';    label = 'Deposit';    }
  if (from === ESCROW_ADDRESS.toLowerCase()) { type = 'reward';     label = 'Reward';     }
  if (isOut && to !== ESCROW_ADDRESS.toLowerCase()) { type = 'withdrawal'; label = 'Withdrawal'; }

  return {
    hash:       tx.hash,
    type,
    label,
    amount:     amountStr,
    time:       timeAgo(parseInt(tx.timeStamp)),
    isPositive: isIn || type === 'reward',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
export default function WalletScreen() {
  const router                    = useRouter();
  const { isLoggedIn, isLoading } = useAuth();
  const { balance: web2Balance, isLoading: walletLoading } = useWallet();
  const { isConnected, address }  = useAppKitAccount();
  const { chainId, switchNetwork } = useAppKitNetwork();

  // UI
  const [showBalance, setShowBalance]       = useState(true);
  const [showDeposit, setShowDeposit]       = useState(false);
  const [showWithdraw, setShowWithdraw]     = useState(false);
  const [depositAmount, setDepositAmount]   = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  // On-chain
  const [onChainBalance, setOnChainBalance]   = useState<string | null>(null);
  const [isFetchingChain, setIsFetchingChain] = useState(false);
  const [txStatus, setTxStatus]               = useState<TxStatus>('idle');
  const [txHash, setTxHash]                   = useState('');
  const [txError, setTxError]                 = useState('');

  // TX history
  const [txHistory, setTxHistory]         = useState<TxItem[]>([]);
  const [isFetchingTx, setIsFetchingTx]   = useState(false);

  // Wrong network — only relevant after wallet is connected
  const isWrongNetwork = isConnected && chainId !== undefined && Number(chainId) !== SEPOLIA_CHAIN_ID;

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoading && !isLoggedIn) router.push('/auth');
  }, [isLoggedIn, isLoading, router]);

  // ── Provider ────────────────────────────────────────────────────────────────
  const getProvider = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const eth = (window as any).ethereum;
    if (!eth) return null;
    return new ethers.BrowserProvider(eth);
  }, []);

  // ── Fetch GVT balance ───────────────────────────────────────────────────────
  const fetchOnChainBalance = useCallback(async () => {
    if (!isConnected || !address) return;
    const provider = getProvider();
    if (!provider) return;
    setIsFetchingChain(true);
    try {
      const gvt = new ethers.Contract(GVT_ADDRESS, GVT_ABI, provider);
      const raw = await gvt.balanceOf(address);
      setOnChainBalance(
        parseFloat(ethers.formatEther(raw))
          .toLocaleString('en-US', { maximumFractionDigits: 2 })
      );
    } catch (e) {
      console.error('[Wallet] balance fetch failed:', e);
      setOnChainBalance(null);
    } finally {
      setIsFetchingChain(false);
    }
  }, [isConnected, address, getProvider]);

  // ── Fetch real TX history from Etherscan ────────────────────────────────────
  const fetchTxHistory = useCallback(async () => {
    if (!isConnected || !address) return;
    setIsFetchingTx(true);
    try {
      // Fetch both normal txs and ERC20 token transfers for this address
      const base = 'https://api-sepolia.etherscan.io/api';

      const [normalRes, tokenRes] = await Promise.all([
        fetch(`${base}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=10&sort=desc&apikey=${ETHERSCAN_API_KEY}`),
        fetch(`${base}?module=account&action=tokentx&contractaddress=${GVT_ADDRESS}&address=${address}&page=1&offset=10&sort=desc&apikey=${ETHERSCAN_API_KEY}`),
      ]);

      const [normalData, tokenData] = await Promise.all([
        normalRes.json(),
        tokenRes.json(),
      ]);

      // Combine, dedupe by hash, sort by timestamp desc
      const all: any[] = [];

      if (tokenData.status === '1' && Array.isArray(tokenData.result)) {
        all.push(...tokenData.result.map((tx: any) => ({ ...tx, _isToken: true })));
      }
      if (normalData.status === '1' && Array.isArray(normalData.result)) {
        // Only include txs that interact with our contracts
        const relevant = normalData.result.filter((tx: any) =>
          [GVT_ADDRESS.toLowerCase(), ESCROW_ADDRESS.toLowerCase()]
            .includes((tx.to || '').toLowerCase())
        );
        all.push(...relevant.map((tx: any) => ({ ...tx, _isToken: false })));
      }

      // Dedupe by hash
      const seen  = new Set<string>();
      const deduped = all.filter(tx => {
        if (seen.has(tx.hash)) return false;
        seen.add(tx.hash);
        return true;
      });

      // Sort newest first, take top 8
      deduped.sort((a, b) => parseInt(b.timeStamp) - parseInt(a.timeStamp));
      setTxHistory(deduped.slice(0, 8).map(tx => classifyTx(tx, address)));
    } catch (e) {
      console.error('[Wallet] tx history fetch failed:', e);
      setTxHistory([]);
    } finally {
      setIsFetchingTx(false);
    }
  }, [isConnected, address]);

  useEffect(() => {
    if (isConnected && address) {
      fetchOnChainBalance();
      fetchTxHistory();
    } else if (!isConnected) {
      setOnChainBalance(null);
      setTxHistory([]);
    }
  }, [isConnected, address, fetchOnChainBalance, fetchTxHistory]);

  // ── Deposit ─────────────────────────────────────────────────────────────────
  const handleDeposit = async () => {
    if (!depositAmount || !address) return;
    const provider = getProvider();
    if (!provider) {
      setTxStatus('error');
      setTxError('No wallet detected. Make sure MetaMask is unlocked.');
      return;
    }
    setTxStatus('approving');
    setTxError('');
    setTxHash('');
    try {
      const signer = await provider.getSigner();
      const gvt    = new ethers.Contract(GVT_ADDRESS, GVT_ABI, signer);
      const amount = ethers.parseEther(depositAmount);

      const allowance = await gvt.allowance(address, ESCROW_ADDRESS);
      if (BigInt(allowance.toString()) < BigInt(amount.toString())) {
        const approveTx = await gvt.approve(ESCROW_ADDRESS, amount);
        await approveTx.wait();
      }

      setTxStatus('sending');
      const tx      = await gvt.transfer(ESCROW_ADDRESS, amount);
      const receipt = await tx.wait();

      setTxHash(receipt.hash);
      setTxStatus('success');
      setDepositAmount('');
      setShowDeposit(false);
      await Promise.all([fetchOnChainBalance(), fetchTxHistory()]);
    } catch (e: any) {
      setTxStatus('error');
      setTxError(e?.reason || e?.shortMessage || e?.message?.slice(0, 150) || 'Transaction failed.');
    }
  };

  // ── Loading / auth ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050B18] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-olos-blue/30 border-t-olos-blue rounded-full animate-spin" />
      </div>
    );
  }
  if (!isLoggedIn) return null;

  // ── Display values ──────────────────────────────────────────────────────────
  const rawBalance     = isConnected ? (onChainBalance?.replace(/,/g, '') || '0') : String(web2Balance);
  const displayBalance = isConnected
    ? (onChainBalance !== null ? `${onChainBalance} GVT` : '— GVT')
    : `${web2Balance.toLocaleString()} GVT`;
  const displayUSD     = `≈ $${(parseFloat(rawBalance) * 0.25).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  const isLoadingBal   = isConnected ? isFetchingChain : walletLoading;

  return (
    <div className="min-h-screen bg-[#050B18] text-white selection:bg-olos-blue/30 overflow-x-hidden pb-24 md:pb-12">
      <Navbar />

      <main className="pt-32 px-4 md:px-8 max-w-[1200px] mx-auto animate-fade-in">
        <h1 className="text-4xl font-black text-olos-blue tracking-tight mb-8">Wallet</h1>

        {/* ── Wrong Network Banner — only shows AFTER wallet is connected ── */}
        {isWrongNetwork && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 flex-shrink-0 text-sm">
                ⚠
              </div>
              <div>
                <p className="text-sm font-bold text-red-400">Wrong Network</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  OLOS runs on Sepolia testnet. Switch to continue.
                </p>
              </div>
            </div>
            <button
              onClick={() => switchNetwork(networks[0])}
              className="px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-xl text-xs font-black uppercase tracking-widest text-red-400 hover:bg-red-500/30 transition-all flex-shrink-0"
            >
              Switch to Sepolia
            </button>
          </div>
        )}

        {/* ── Total Balance Card ──────────────────────────────────────────── */}
        <div className="bg-[#0B1121]/40 border border-white/10 rounded-[20px] p-8 mb-6 relative">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-3">
                Total Balance
              </p>
              <div className="flex items-baseline gap-3">
                {isLoadingBal ? (
                  <div className="w-44 h-9 bg-white/10 rounded-lg animate-pulse" />
                ) : (
                  <h2 className="text-3xl font-black tracking-tight">
                    {showBalance ? displayBalance : '* * * *'}
                  </h2>
                )}
                {isConnected && !isFetchingChain && (
                  <button
                    onClick={fetchOnChainBalance}
                    title="Refresh balance"
                    className="text-gray-600 hover:text-olos-blue transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                      <path d="M3 3v5h5"/>
                    </svg>
                  </button>
                )}
              </div>
              <p className="text-sm font-bold text-gray-500 mt-1">
                {showBalance ? displayUSD : '≈ * * * *'}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-olos-blue/50'}`} />
                <span className="text-[9px] font-bold uppercase tracking-widest text-gray-600">
                  {isConnected ? 'Live · Sepolia Testnet' : 'Platform balance · Supabase'}
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowBalance(v => !v)}
              className="text-gray-500 hover:text-white transition-colors p-2"
            >
              {showBalance ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4-8-11-8-11 8-11 8z"/>
                  <circle cx="12" cy="12" r="3"/>
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

        {/* ── Wallet Connect Badge ────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="bg-[#0B1121]/40 border border-white/10 rounded-[20px] p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-2">
                  {isConnected ? 'Web3 Wallet Connected' : 'Connect Your Wallet'}
                </p>
                {isConnected && address ? (
                  <>
                    <p className="text-sm font-mono text-white mb-1">
                      {address.slice(0, 6)}...{address.slice(-4)}
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                      <p className="text-xs font-bold text-green-400">Ready for staking</p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-400">
                    Connect MetaMask or WalletConnect to see your live GVT balance and stake in matches
                  </p>
                )}
              </div>
              <div className="w-full md:w-auto">
                <ConnectWalletButton variant="page" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Action Grid ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <SmallActionCard
            label="Rewards"
            value={showBalance ? '1,250' : '* *'}
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17M14 14.66V17M18 2H6v7a6 6 0 0 0 12 0V2z"/>
              </svg>
            }
          />

          <SmallActionCard
            label="NFT's"
            value={showBalance ? '7' : '*'}
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            }
          />

          {/* Deposit */}
          <button
            onClick={() => { setShowDeposit(v => !v); setShowWithdraw(false); setTxStatus('idle'); setTxError(''); }}
            disabled={!isConnected || isWrongNetwork}
            className={`col-span-1 h-32 md:h-auto rounded-2xl flex flex-col items-center justify-center gap-3
              transition-all active:scale-95 shadow-lg relative overflow-hidden
              ${isConnected && !isWrongNetwork
                ? 'bg-[#3B82F6] shadow-blue-500/20 hover:bg-blue-500 cursor-pointer'
                : 'bg-[#3B82F6]/30 cursor-not-allowed'}`}
          >
            <div className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </div>
            <span className="text-xs font-black uppercase tracking-widest">Deposit</span>
            {!isConnected && <span className="text-[9px] text-white/40 absolute bottom-2">Connect wallet</span>}
            {isConnected && isWrongNetwork && <span className="text-[9px] text-white/40 absolute bottom-2">Wrong network</span>}
          </button>

          {/* Withdraw */}
          <button
            onClick={() => { setShowWithdraw(v => !v); setShowDeposit(false); setTxStatus('idle'); setTxError(''); }}
            disabled={!isConnected || isWrongNetwork}
            className={`col-span-1 h-32 md:h-auto rounded-2xl flex flex-col items-center justify-center gap-3
              transition-all active:scale-95 shadow-lg relative overflow-hidden
              ${isConnected && !isWrongNetwork
                ? 'bg-[#3B82F6] shadow-blue-500/20 hover:bg-blue-500 cursor-pointer'
                : 'bg-[#3B82F6]/30 cursor-not-allowed'}`}
          >
            <div className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5M5 12l7-7 7 7"/>
                <path d="M5 19h14"/>
              </svg>
            </div>
            <span className="text-xs font-black uppercase tracking-widest">Withdraw</span>
            {!isConnected && <span className="text-[9px] text-white/40 absolute bottom-2">Connect wallet</span>}
            {isConnected && isWrongNetwork && <span className="text-[9px] text-white/40 absolute bottom-2">Wrong network</span>}
          </button>

          {/* History — links to Etherscan */}
          <a
            href={isConnected && address
              ? `https://sepolia.etherscan.io/address/${address}#tokentxns`
              : '#'}
            target={isConnected ? '_blank' : '_self'}
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center p-6 bg-[#0B1121]/40 border border-white/10 rounded-2xl hover:border-olos-blue/30 transition-all cursor-pointer group"
          >
            <div className="text-olos-blue mb-4 group-hover:scale-110 transition-transform">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">History</p>
            {isConnected && (
              <p className="text-[9px] text-olos-blue/60 font-bold">Etherscan ↗</p>
            )}
          </a>
        </div>

        {/* ── Deposit Panel ───────────────────────────────────────────────── */}
        {showDeposit && isConnected && !isWrongNetwork && (
          <div className="bg-[#0B1121]/60 border border-olos-blue/30 rounded-[20px] p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-olos-blue">Deposit GVT</h3>
              <button onClick={() => { setShowDeposit(false); setTxStatus('idle'); }} className="text-gray-500 hover:text-white transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Transfers GVT from your wallet into the OLOS escrow contract for match staking.
            </p>
            <div className="flex gap-3 mb-3">
              <input
                type="number"
                value={depositAmount}
                onChange={e => setDepositAmount(e.target.value)}
                placeholder="Amount in GVT"
                min="1"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-olos-blue/50 transition-colors"
              />
              <button
                onClick={() => setDepositAmount(rawBalance)}
                className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:border-olos-blue/30 transition-all"
              >
                MAX
              </button>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
              <span>Available: <span className="text-white font-bold">{onChainBalance ?? '—'} GVT</span></span>
              {depositAmount && !isNaN(parseFloat(depositAmount)) && (
                <span>≈ ${(parseFloat(depositAmount) * 0.25).toFixed(2)} USD</span>
              )}
            </div>
            <TxStatusBar status={txStatus} hash={txHash} error={txError} />
            <button
              onClick={handleDeposit}
              disabled={!depositAmount || txStatus === 'approving' || txStatus === 'sending'}
              className="w-full py-3 bg-olos-blue rounded-xl text-sm font-black uppercase tracking-widest
                transition-all hover:bg-blue-500 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {txStatus === 'approving' ? '1/2 Approving...' :
               txStatus === 'sending'   ? '2/2 Depositing...' :
               txStatus === 'success'   ? '✓ Done!' : 'Deposit GVT'}
            </button>
          </div>
        )}

        {/* ── Withdraw Panel ──────────────────────────────────────────────── */}
        {showWithdraw && isConnected && !isWrongNetwork && (
          <div className="bg-[#0B1121]/60 border border-white/10 rounded-[20px] p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-white">Withdraw GVT</h3>
              <button onClick={() => setShowWithdraw(false)} className="text-gray-500 hover:text-white transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-4">
              <p className="text-xs text-yellow-400 font-bold leading-relaxed">
                ⚠ Escrow withdrawals require a backend-signed release — coming in the next release.
                GVT not yet staked stays in your wallet and can be transferred freely.
              </p>
            </div>
            <input
              type="number"
              value={withdrawAmount}
              onChange={e => setWithdrawAmount(e.target.value)}
              placeholder="Amount in GVT"
              disabled
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 mb-4 opacity-40 cursor-not-allowed"
            />
            <button disabled className="w-full py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-black uppercase tracking-widest opacity-40 cursor-not-allowed">
              Coming Soon
            </button>
          </div>
        )}

        {/* ── Recent Activity ─────────────────────────────────────────────── */}
        <div className="bg-[#0B1121]/40 border border-white/10 rounded-2xl p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-sm font-bold uppercase tracking-widest text-white">Recent Activity</h2>
            {isConnected && address && (
              <a
                href={`https://sepolia.etherscan.io/address/${address}#tokentxns`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] font-bold text-olos-blue/60 hover:text-olos-blue uppercase tracking-widest transition-colors"
              >
                View All ↗
              </a>
            )}
          </div>

          {/* Loading state */}
          {isFetchingTx && (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-16 bg-white/5 rounded-2xl animate-pulse" />
              ))}
            </div>
          )}

          {/* No wallet connected */}
          {!isConnected && !isFetchingTx && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4 text-gray-600">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <p className="text-sm font-bold text-gray-500">Connect your wallet to see activity</p>
              <p className="text-xs text-gray-700 mt-1">Your on-chain transaction history will appear here</p>
            </div>
          )}

          {/* Connected but no txs yet */}
          {isConnected && !isFetchingTx && txHistory.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4 text-gray-600">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
              </div>
              <p className="text-sm font-bold text-gray-500">No transactions yet</p>
              <p className="text-xs text-gray-700 mt-1">Make a deposit to get started</p>
            </div>
          )}

          {/* Real tx history */}
          {!isFetchingTx && txHistory.length > 0 && (
            <div className="space-y-4">
              {txHistory.map(tx => (
                <ActivityRow key={tx.hash} tx={tx} />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── Mobile Bottom Nav ────────────────────────────────────────────── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-[#0B1121]/95 backdrop-blur-md border-t border-white/10 flex items-center justify-around px-6 z-[100]">
        <MobileNavItem label="Wallet" active
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/><path d="M18 12H22"/></svg>}
        />
        <MobileNavItem label="Deposit" disabled={!isConnected || isWrongNetwork}
          onClick={() => { setShowDeposit(v => !v); setShowWithdraw(false); }}
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>}
        />
        <MobileNavItem label="Withdraw" disabled={!isConnected || isWrongNetwork}
          onClick={() => { setShowWithdraw(v => !v); setShowDeposit(false); }}
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/><path d="M5 19h14"/></svg>}
        />
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SmallActionCard({ label, value, icon }: { label: string; value?: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center p-6 bg-[#0B1121]/40 border border-white/10 rounded-2xl hover:border-olos-blue/30 transition-all cursor-pointer group">
      <div className="text-olos-blue mb-4 group-hover:scale-110 transition-transform">{icon}</div>
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">{label}</p>
      {value && <p className="text-sm font-black text-white">{value}</p>}
    </div>
  );
}

function TxStatusBar({ status, hash, error }: { status: TxStatus; hash: string; error: string }) {
  if (status === 'idle') return null;
  return (
    <div className={`rounded-xl px-4 py-3 mb-4 text-xs font-bold flex items-center gap-2
      ${status === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' :
        status === 'error'   ? 'bg-red-500/10 border border-red-500/20 text-red-400' :
                               'bg-olos-blue/10 border border-olos-blue/20 text-olos-blue'}`}
    >
      {(status === 'approving' || status === 'sending') && (
        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0" />
      )}
      <span>
        {status === 'approving' && 'Step 1/2 — Confirm approval in MetaMask...'}
        {status === 'sending'   && 'Step 2/2 — Confirm transfer in MetaMask...'}
        {status === 'success'   && <>Deposit confirmed! {hash && <a href={`https://sepolia.etherscan.io/tx/${hash}`} target="_blank" rel="noopener noreferrer" className="underline ml-1">View on Etherscan ↗</a>}</>}
        {status === 'error'     && error}
      </span>
    </div>
  );
}

function ActivityRow({ tx }: { tx: TxItem }) {
  const iconBg =
    tx.type === 'deposit'    ? 'bg-green-500/10 text-green-500' :
    tx.type === 'withdrawal' ? 'bg-red-500/10 text-red-500'     :
    tx.type === 'reward'     ? 'bg-olos-blue/10 text-olos-blue' :
                               'bg-white/5 text-gray-400';
  return (
    <a
      href={`https://sepolia.etherscan.io/tx/${tx.hash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between p-5 bg-white/5 rounded-2xl hover:bg-white/[0.08] transition-all cursor-pointer group"
    >
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          {tx.type === 'deposit' && (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          )}
          {tx.type === 'withdrawal' && (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/><path d="M5 19h14"/></svg>
          )}
          {tx.type === 'reward' && (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17M14 14.66V17M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>
          )}
          {tx.type === 'other' && (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          )}
        </div>
        <div>
          <h4 className="text-sm font-bold text-white">{tx.label}</h4>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{tx.time}</p>
            <span className="text-[10px] text-olos-blue/50 group-hover:text-olos-blue transition-colors">↗ tx</span>
          </div>
        </div>
      </div>
      <div className="text-right">
        <p className={`text-sm font-black ${tx.isPositive ? 'text-green-500' : 'text-red-500'}`}>{tx.amount}</p>
        <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest mt-0.5">GVT</p>
      </div>
    </a>
  );
}

function MobileNavItem({ icon, label, active, disabled, onClick }: {
  icon: React.ReactNode; label: string; active?: boolean; disabled?: boolean; onClick?: () => void;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex flex-col items-center gap-1 transition-all
        ${active   ? 'text-olos-blue scale-110' : ''}
        ${disabled ? 'text-gray-700 cursor-not-allowed' : !active ? 'text-gray-500 hover:text-white' : ''}`}
    >
      {icon}
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      {active && <div className="w-1 h-1 rounded-full bg-olos-blue mt-0.5 shadow-[0_0_8px_#3B82F6]" />}
    </button>
  );
}