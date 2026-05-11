'use client';

import Navbar from "@/components/Navbar";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import UsernameModal from "@/components/UsernameModal";

export default function HomeScreen() {
  const { needsUsername, completeUsername } = useAuth();
  return (
    <div className="min-h-screen bg-[#0B1121] text-white selection:bg-olos-blue/30 overflow-x-hidden">
      {/* Username setup modal for Google users */}
      {needsUsername && (
        <UsernameModal onComplete={completeUsername} />
      )}
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative mx-auto mt-[83px] h-[633px] flex items-center justify-center px-[79px] pb-0 -mb-20 overflow-hidden">
        {/* Background Image Layer */}
        <div className="absolute inset-0 z-0 bg-[url('/olos-logo-3d.png')] bg-[length:contain] bg-[position:65%_center] bg-no-repeat scale-110 -translate-y-8 opacity-80" />
        {/* Overlay Layer */}
        <div className="absolute inset-0 z-0 bg-[#030711]/10" />
        
        <div className="relative z-10 max-w-[1567px] w-full h-full flex items-center justify-start -translate-y-8">
          
          {/* Left Column: Text & Buttons */}
          <div className="flex flex-col items-start text-left z-10 animate-fade-in order-2 lg:order-1 lg:min-w-[600px] -mt-16">
            <h1 className="font-bai text-[64px] font-bold leading-[100%] tracking-[0%] mb-6 text-gradient-hero whitespace-nowrap min-w-[612px]">
              Play, Complete, Win
            </h1>
            <p className="max-w-[500px] text-[18px] md:text-[20px] text-slate-400 font-medium mb-10 leading-relaxed">
              Skill-based games where you complete 1v1, stake tokens, and win instantly.
            </p>
            
            <div className="flex flex-wrap items-center gap-[47px]">
              <Link href="/games" className="h-[44px] px-8 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white font-bold text-[15px] flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-blue-500/20 active:scale-95">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="mt-0.5">
                  <path d="M3 2V12L11 7L3 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Play Now
              </Link>
              <Link href="/leaderboard" className="h-[44px] px-8 rounded-full bg-transparent hover:bg-white/5 border border-white/5 text-white font-bold text-[15px] flex items-center justify-center transition-all active:scale-95">
                View Leaderboards
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="relative z-10 pt-20 pb-24 bg-[#020617]/50">
        <div className="max-w-[1567px] mx-auto px-8 lg:px-16">
          <h2 className="text-[#00d2ff] text-[15px] font-black uppercase tracking-[0.4em] mb-20 text-center">How It Works</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-20">
            <Step 
              number="1"
              title="Play Free"
              description="Practice any game without signing up, no wallet needed."
            />
            <Step 
              number="2"
              title="Stake & Complete"
              description="Create an account, stake GVT tokens, and challenge real players."
            />
            <Step 
              number="3"
              title="Win Rewards"
              description="Beat your opponent and collect the pot (minus 5% platform fee)."
            />
          </div>
        </div>
      </section>

      {/* Featured Games Section */}
      <section className="py-32">
        <div className="max-w-[1567px] mx-auto px-8 lg:px-16">
          <div className="flex items-center justify-between mb-16 px-2">
            <h2 className="text-4xl md:text-[32px] font-black tracking-tight uppercase text-white font-sans">Featured Games</h2>
            <Link href="/games" className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors font-bold text-sm group">
              View All
              <span className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center group-hover:border-white/30 transition-colors">
                <svg className="w-3.5 h-3.5 transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"/></svg>
              </span>
            </Link>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <GameCard 
              image="/snake.png"
              title="Snake"
              description="Classic snake game. Eat food, grow longer, avoid walls!"
            />
            <GameCard 
              image="/jumping-jack.png"
              title="Jumping Jack"
              description="Jump between platforms. How high can you climb?"
            />
            <GameCard 
              image="/bounce.png"
              title="Bounce"
              description="Keep the ball bouncing. Avoid obstacles!"
            />
            <GameCard 
              image="/tetris.png"
              title="Tetris"
              description="Stack blocks, clear lines, beat your score!"
            />
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="py-32">
        <div className="max-w-[1567px] mx-auto px-8 lg:px-16 grid grid-cols-2 lg:grid-cols-4 gap-12 text-center">
          <Stat value="12.4K" label="Active Players" />
          <Stat value="48.2K" label="Matches Played" />
          <Stat value="1.2M" label="GVT Wagered" />
          <Stat value="856K" label="GVT Won" />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-40 text-center">
        <div className="max-w-[1567px] mx-auto px-8 lg:px-16 border-t border-white/5">
        <h2 className="text-4xl md:text-[44px] font-black tracking-tighter mb-6 uppercase text-[#00d2ff]">Ready to Complete?</h2>
        <p className="text-gray-400 mb-10 text-lg font-medium">Join thousands of players staking and winning every day.</p>
        <Link href="/games" className="px-14 py-4 rounded-xl bg-olos-blue hover:bg-olos-cobalt text-white font-bold text-lg transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-blue-900/30">
          Start Playing
        </Link>
        </div>
      </section>

      <footer className="py-20 bg-[#010101]">
        <div className="max-w-[1567px] mx-auto px-8 lg:px-16 text-center text-gray-600 text-sm font-bold uppercase tracking-widest leading-relaxed">
          © 2026 Olos Competitive Gaming. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-14 h-14 rounded-full bg-olos-blue flex items-center justify-center text-white text-xl font-black mb-8">
        {number}
      </div>
      <h3 className="text-lg font-black mb-4 text-white uppercase tracking-wider">{title}</h3>
      <p className="text-gray-500 font-bold leading-relaxed max-w-[200px] text-center text-sm">{description}</p>
    </div>
  );
}

function GameCard({ image, title, description }: { image: string; title: string; description: string }) {
  return (
    <div className="flex flex-col bg-[#0a0f1e] rounded-3xl border border-blue-500/10 overflow-hidden group hover:border-blue-500/30 transition-all hover:translate-y-[-4px]">
      <div className="aspect-[1.4] overflow-hidden">
        <img src={image} alt={title} className="w-full h-full object-cover grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300" />
      </div>
      <div className="p-6 flex-1 flex flex-col">
        <h3 className="text-xl font-black text-white mb-2">{title}</h3>
        <p className="text-gray-500 text-xs font-bold leading-relaxed mb-6 line-clamp-2 flex-1">{description}</p>
        <div className="flex gap-2">
          <button className="px-5 py-1.5 rounded-full border border-blue-500/20 text-[11px] font-black uppercase text-blue-500 hover:bg-blue-500 hover:text-white transition-all">Solo</button>
          <button className="px-5 py-1.5 rounded-full border border-blue-500/20 text-[11px] font-black uppercase text-blue-500 hover:bg-blue-500 hover:text-white transition-all">1v1</button>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[48px] md:text-[56px] font-black text-white tracking-tighter leading-none">{value}</div>
      <div className="text-[12px] font-black text-gray-500 uppercase tracking-[0.2em]">{label}</div>
    </div>
  );
}
