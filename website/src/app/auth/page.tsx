"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

type Tab = "signin" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const { login, isLoggedIn } = useAuth();

  const [tab, setTab] = useState<Tab>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // If already logged in → redirect to home
  useEffect(() => {
    if (isLoggedIn) router.push("/");
  }, [isLoggedIn, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // Call your backend auth API
      const endpoint = tab === "signin" ? "/api/auth/login" : "/api/auth/register";
      const body = tab === "signin" 
        ? { email, password }
        : { email, password, username };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Authentication failed");
      }

      const data = await response.json();
      
      // Pass the user and session data to login
      login({ user: data.user, session: data.session });
      router.push("/");
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#070E1A] flex items-center justify-center px-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/">
            <span className="text-3xl font-black text-white tracking-wider">OLOS</span>
          </Link>
          <p className="text-gray-400 text-sm mt-2">Play, Complete, Win</p>
        </div>

        <div className="bg-[#0B1121] border border-white/8 rounded-2xl p-8 shadow-2xl">

          {/* Social Login Options */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button className="flex items-center justify-center gap-2.5 px-4 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/8 hover:border-white/20 transition-all text-sm font-bold text-white">
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </button>
            <button className="flex items-center justify-center gap-2.5 px-4 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/8 hover:border-white/20 transition-all text-sm font-bold text-white">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              Apple
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-white/8" />
            <span className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">
              or use email
            </span>
            <div className="flex-1 h-px bg-white/8" />
          </div>

          {/* Email/Password form */}
          <div className="mb-2">
            {/* Sign In / Sign Up tabs */}
            <div className="flex bg-white/5 rounded-xl p-1 mb-5">
              <button
                onClick={() => setTab("signin")}
                className={`flex-1 py-2 text-[13px] font-bold rounded-lg transition-all ${
                  tab === "signin"
                    ? "bg-olos-blue text-white shadow"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setTab("signup")}
                className={`flex-1 py-2 text-[13px] font-bold rounded-lg transition-all ${
                  tab === "signup"
                    ? "bg-olos-blue text-white shadow"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {tab === "signup" && (
                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="your_username"
                    required
                    className="w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-olos-blue/50 transition-colors"
                  />
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="player@example.com"
                  required
                  className="w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-olos-blue/50 transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    Password
                  </label>
                  {tab === "signin" && (
                    <Link href="/auth/forgot-password" className="text-[11px] text-gray-500 hover:text-olos-blue transition-colors">
                      Forgot password?
                    </Link>
                  )}
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-olos-blue/50 transition-colors"
                />
              </div>

              {error && (
                <p className="text-red-400 text-xs font-medium bg-red-400/5 border border-red-400/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-olos-blue hover:bg-olos-cobalt disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-[14px] rounded-xl transition-all active:scale-95 mt-1"
              >
                {loading ? "Please wait..." : tab === "signin" ? "Sign In" : "Create Account"}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          By continuing you agree to OLOS{" "}
          <Link href="/terms" className="text-gray-400 hover:text-white transition-colors">Terms</Link>
          {" & "}
          <Link href="/privacy" className="text-gray-400 hover:text-white transition-colors">Privacy</Link>
        </p>
      </div>
    </div>
  );
}