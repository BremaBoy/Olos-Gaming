"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { useAuth } from '@/context/AuthContext';
import { useWallet } from '@/context/WalletContext';

export default function Navbar() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { isLoggedIn, user, logout } = useAuth();
  const { balance } = useWallet();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const navLink = (href: string, label: string) => {
    const isActive = pathname === href || pathname.startsWith(href + '/');
    return (
      <Link
        href={href}
        className={`relative text-[13px] font-bold transition-colors group ${
          isActive ? 'text-white' : 'text-gray-400 hover:text-white'
        }`}
      >
        {label}
        <span
          className={`absolute -bottom-1 left-0 right-0 mx-auto w-1 h-1 rounded-full bg-olos-blue transition-opacity ${
            isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'
          }`}
        />
      </Link>
    );
  };
  
  return (
    <nav className="fixed top-0 w-full z-[100] bg-[#0B1121]/95 backdrop-blur-sm border-b border-white/5 py-4">
      <div className="max-w-[1567px] mx-auto px-8 lg:px-16 flex items-center justify-between">
        {/* Left: Logo and Links */}
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center group">
            <span className="text-xl font-black text-white tracking-wider">OLOS</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navLink('/games', 'Games')}
            {navLink('/leaderboard', 'Leaderboards')}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-4">
          {!isLoggedIn ? (
            <>
              <div className="hidden lg:flex items-center gap-4">
                <Link href="#" className="hover:opacity-80 transition-opacity">
                  <img src="https://upload.wikimedia.org/wikipedia/commons/3/3c/Download_on_the_App_Store_Badge.svg" alt="App Store" className="h-9" />
                </Link>
                <Link href="#" className="hover:opacity-80 transition-opacity">
                  <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" alt="Google Play" className="h-9" />
                </Link>
              </div>
              <Link href="/auth" className="px-10 py-2.5 rounded-lg bg-olos-blue hover:bg-olos-cobalt text-white text-[13px] font-bold transition-all active:scale-95 shadow-lg shadow-blue-900/20">
                Sign In
              </Link>
            </>
          ) : (
            <div className="flex items-center gap-4 relative">
              {/* Wallet Badge */}
              <Link href="/wallet" className="flex items-center gap-3 px-4 py-2.5 bg-[#1A232E]/50 border border-white/10 rounded-xl hover:border-white/20 transition-all group">
                <div className="text-olos-blue">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/><path d="M18 12H22"/></svg>
                </div>
                <span className="text-[13px] font-black tracking-tight text-white">{balance.toFixed(2)} GVT</span>
              </Link>

              {/* Profile Wrapper */}
              <div className="relative">
                <button 
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className={`flex items-center gap-3 px-4 py-2.5 bg-[#1A232E]/50 border rounded-xl transition-all ${isProfileOpen ? 'border-olos-blue' : 'border-white/10 hover:border-white/20'}`}
                >
                  <div className="text-gray-400">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </div>
                  <span className="text-[11px] font-bold text-gray-300 uppercase tracking-widest hidden sm:block">
                    {user?.username || user?.email?.split('@')[0] || 'Player'}
                  </span>
                </button>

                {/* Dropdown Menu */}
                {isProfileOpen && (
                  <div className="absolute top-[calc(100%+8px)] right-0 w-48 bg-[#0B1121] border border-white/10 rounded-xl shadow-2xl py-2 overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <Link href="/profile" className="flex items-center gap-3 px-4 py-3 text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-all">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      Profile
                    </Link>
                    <Link href="/leaderboard" className="flex items-center gap-3 px-4 py-3 text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-all">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17M14 14.66V17M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>
                      Leaderboards
                    </Link>
                    <div className="h-px bg-white/5 my-1" />
                    <button 
                      onClick={() => {
                        logout();
                        router.push('/');
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-red-400 hover:bg-red-400/5 transition-all"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
