"use client";

import { useState } from "react";
import { useAppKitAccount } from "@reown/appkit/react";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";

type StakeTab = "stake" | "unstake";

const PRESET_AMOUNTS = [100, 250, 500, 1000];
const USER_BALANCE = 1000; // TODO: fetch from backend/contract

export default function StakePage() {
  const { isConnected, address } = useAppKitAccount();
  const { isLoggedIn } = useAuth();
  const [tab, setTab] = useState<StakeTab>("stake");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [txState, setTxState] = useState<"idle" | "confirming" | "success" | "error">("idle");

  const isWeb3User = isConnected && address;
  const isAuthed = isLoggedIn || isWeb3User;

  async function handleStake() {
    if (!amount || isNaN(Number(amount))) return;
    setLoading(true);
    setTxState("confirming");

    
    try {
      // ── Web3 user: wagmi writeContract will go here ──
      // const { hash } = await writeContract({
      //   address: GVT_CONTRACT_ADDRESS,
      //   abi: GVT_ABI,
      //   functionName: 'stake',
      //   args: [parseEther(amount)],
      // });

      // ── Web2 user: call your backend API ──
      // const res = await fetch('/api/stake', {
      //   method: 'POST',
      //   body: JSON.stringify({ amount }),
      //   headers: { 'Content-Type': 'application/json' },
      // });

      // Simulate for now
      await new Promise((r) => setTimeout(r, 2000));
      setTxState("success");
    } catch {
      setTxState("error");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setAmount("");
    setTxState("idle");
  }

  return (
    <div className="min-h-screen bg-[#070E1A]">
      <Navbar />

      <main className="pt-28 pb-16 px-4">
        <div className="max-w-lg mx-auto">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-black text-white mb-2">Stake GVT</h1>
            <p className="text-gray-400 text-sm">
              Stake tokens to enter 1v1 matches. Winner takes the pot minus a 5% platform fee.
            </p>
          </div>

          {/* Not authed */}
          {!isAuthed && (
            <div className="bg-[#0B1121] border border-white/10 rounded-2xl p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-olos-blue/10 flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <h2 className="text-white font-bold text-lg mb-2">Sign in to stake</h2>
              <p className="text-gray-400 text-sm mb-6">You need an account or wallet to stake GVT tokens.</p>
              <a href="/auth" className="inline-flex items-center justify-center px-6 py-3 bg-olos-blue hover:bg-olos-cobalt rounded-xl text-white font-bold text-sm transition-all">
                Get Started
              </a>
            </div>
          )}

          {/* Authed */}
          {isAuthed && (
            <>
              {/* Wallet type banner */}
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border mb-6 ${
                isWeb3User
                  ? "bg-green-500/5 border-green-500/20"
                  : "bg-blue-500/5 border-blue-500/20"
              }`}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${isWeb3User ? "bg-green-400" : "bg-blue-400"}`} />
                <p className="text-sm text-gray-300">
                  {isWeb3User
                    ? `Connected: ${address?.slice(0, 6)}...${address?.slice(-4)} · Your wallet will sign the transaction`
                    : "Managed wallet active · We handle the transaction for you"}
                </p>
              </div>

              {/* Balance card */}
              <div className="bg-[#0B1121] border border-white/10 rounded-2xl p-6 mb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Available Balance</span>
                  <span className="text-[11px] text-gray-500">Polygon Network</span>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-black text-white">{USER_BALANCE.toLocaleString()}</span>
                  <span className="text-lg font-bold text-gray-400 mb-1">GVT</span>
                </div>
              </div>

              {/* Stake / Unstake tabs */}
              <div className="bg-[#0B1121] border border-white/10 rounded-2xl p-6">
                <div className="flex bg-white/5 rounded-xl p-1 mb-6">
                  {(["stake", "unstake"] as StakeTab[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => { setTab(t); reset(); }}
                      className={`flex-1 py-2.5 text-[13px] font-bold rounded-lg capitalize transition-all ${
                        tab === t ? "bg-olos-blue text-white" : "text-gray-400 hover:text-white"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {/* Success state */}
                {txState === "success" ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-4">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <h3 className="text-white font-black text-xl mb-1">
                      {tab === "stake" ? "Staked!" : "Unstaked!"}
                    </h3>
                    <p className="text-gray-400 text-sm mb-6">
                      {amount} GVT {tab === "stake" ? "locked for your next match" : "returned to your wallet"}
                    </p>
                    <button
                      onClick={reset}
                      className="px-6 py-2.5 border border-white/10 rounded-xl text-sm font-bold text-gray-300 hover:text-white hover:border-white/20 transition-all"
                    >
                      {tab === "stake" ? "Stake More" : "Unstake More"}
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Amount input */}
                    <div className="mb-4">
                      <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">
                        Amount (GVT)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="0.00"
                          min="1"
                          max={USER_BALANCE}
                          className="w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-4 text-xl font-black text-white placeholder-gray-700 focus:outline-none focus:border-olos-blue/50 transition-colors pr-20"
                        />
                        <button
                          onClick={() => setAmount(String(USER_BALANCE))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-olos-blue/10 hover:bg-olos-blue/20 border border-olos-blue/20 rounded-lg text-olos-blue text-[11px] font-bold transition-all"
                        >
                          MAX
                        </button>
                      </div>
                    </div>

                    {/* Preset amounts */}
                    <div className="grid grid-cols-4 gap-2 mb-6">
                      {PRESET_AMOUNTS.map((preset) => (
                        <button
                          key={preset}
                          onClick={() => setAmount(String(preset))}
                          className={`py-2 rounded-xl text-[12px] font-bold transition-all border ${
                            amount === String(preset)
                              ? "bg-olos-blue/20 border-olos-blue/40 text-olos-blue"
                              : "bg-white/3 border-white/8 text-gray-400 hover:border-white/20 hover:text-white"
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>

                    {/* Fee breakdown */}
                    {amount && !isNaN(Number(amount)) && Number(amount) > 0 && (
                      <div className="bg-white/3 border border-white/8 rounded-xl p-4 mb-6 text-[12px] space-y-2">
                        <div className="flex justify-between text-gray-400">
                          <span>Amount</span>
                          <span className="text-white font-bold">{Number(amount).toLocaleString()} GVT</span>
                        </div>
                        <div className="flex justify-between text-gray-400">
                          <span>Platform fee (5%)</span>
                          <span className="text-white font-bold">{(Number(amount) * 0.05).toFixed(2)} GVT</span>
                        </div>
                        <div className="h-px bg-white/8" />
                        <div className="flex justify-between text-gray-300 font-bold">
                          <span>If you win</span>
                          <span className="text-green-400">+{(Number(amount) * 0.95).toFixed(2)} GVT</span>
                        </div>
                      </div>
                    )}

                    {/* Error */}
                    {txState === "error" && (
                      <p className="text-red-400 text-xs bg-red-400/5 border border-red-400/20 rounded-lg px-3 py-2 mb-4">
                        Transaction failed. Please try again.
                      </p>
                    )}

                    {/* Submit */}
                    <button
                      onClick={handleStake}
                      disabled={!amount || isNaN(Number(amount)) || Number(amount) <= 0 || loading}
                      className="w-full py-4 bg-olos-blue hover:bg-olos-cobalt disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-[15px] rounded-xl transition-all active:scale-95"
                    >
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                          {isWeb3User ? "Confirm in wallet..." : "Processing..."}
                        </span>
                      ) : (
                        `${tab === "stake" ? "Stake" : "Unstake"} ${amount ? Number(amount).toLocaleString() : ""} GVT`
                      )}
                    </button>
                  </>
                )}
              </div>

              {/* How it works */}
              <div className="mt-6 grid grid-cols-3 gap-3">
                {[
                  { n: "1", label: "Stake GVT", desc: "Lock tokens for a match" },
                  { n: "2", label: "Play 1v1", desc: "Complete the challenge" },
                  { n: "3", label: "Win the pot", desc: "Minus 5% platform fee" },
                ].map((step) => (
                  <div key={step.n} className="bg-[#0B1121] border border-white/8 rounded-xl p-4 text-center">
                    <div className="w-7 h-7 rounded-full bg-olos-blue flex items-center justify-center mx-auto mb-2 text-white text-[11px] font-black">
                      {step.n}
                    </div>
                    <p className="text-white text-[12px] font-bold mb-0.5">{step.label}</p>
                    <p className="text-gray-500 text-[11px]">{step.desc}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}