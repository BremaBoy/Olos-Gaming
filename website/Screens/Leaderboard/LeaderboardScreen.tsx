'use client';

import React, { useState } from 'react';
import Navbar from '@/components/Navbar';

interface LeaderboardPlayer {
  rank: number;
  username: string;
  wins: number;
  earned: number;
  streak: number;
  avatarColor: string;
}

const MOCK_PLAYERS: LeaderboardPlayer[] = [
  { rank: 1, username: 'CryptoKing', wins: 156, earned: 10200, streak: 12, avatarColor: '#f59e0b' },
  { rank: 2, username: 'SnakeMaster', wins: 142, earned: 10200, streak: 8, avatarColor: '#3b82f6' },
  { rank: 3, username: 'BlockChamp', wins: 142, earned: 8900, streak: 5, avatarColor: '#ef4444' },
  { rank: 4, username: 'GamerZone', wins: 120, earned: 8000, streak: 4, avatarColor: '#10b981' },
  { rank: 5, username: 'Waleed01@', wins: 120, earned: 8000, streak: 4, avatarColor: '#8b5cf6' },
  { rank: 6, username: 'Umar88821', wins: 115, earned: 7000, streak: 3, avatarColor: '#ec4899' },
  { rank: 7, username: 'Jamilkhalil', wins: 100, earned: 6000, streak: 4, avatarColor: '#f97316' },
  { rank: 8, username: 'Haidar454', wins: 90, earned: 3000, streak: 2, avatarColor: '#6366f1' },
];

export default function LeaderboardScreen() {
  const [filter, setFilter] = useState('All Time');
  const [game, setGame] = useState('All Games');

  const podiumOrder = [MOCK_PLAYERS[1], MOCK_PLAYERS[0], MOCK_PLAYERS[2]];

  return (
    <div className="min-h-screen bg-[#050B18] text-white selection:bg-olos-blue/30 overflow-x-hidden">
      <Navbar />

      <main className="pt-32 pb-20 px-4 md:px-8 max-w-[1200px] mx-auto animate-fade-in">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight uppercase mb-2 text-gradient-hero">Leaderboards</h1>
          <p className="text-gray-500 font-bold tracking-tight">Top players ranked by performance</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div className="relative group">
            <select 
              value={game}
              onChange={(e) => setGame(e.target.value)}
              className="bg-[#0B1121]/50 border border-white/10 rounded-xl px-6 py-3 text-sm font-bold text-white appearance-none pr-12 focus:outline-none focus:border-[#3B82F6]/50 transition-all cursor-pointer"
            >
              <option>All Games</option>
              <option>Snake</option>
              <option>Chess</option>
              <option>Checkers</option>
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>

          <div className="flex p-1 bg-[#0B1121]/50 border border-white/10 rounded-xl">
            {['Daily', 'Weekly', 'All Time'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                  filter === f 
                    ? 'bg-[#3B82F6] text-white shadow-lg shadow-blue-500/20' 
                    : 'text-gray-500 hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Podium */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {podiumOrder.map((player, idx) => (
            <div 
              key={player.username}
              className={`relative bg-[#0B1121]/40 border border-white/10 rounded-2xl p-8 flex flex-col items-center group hover:border-[#3B82F6]/30 transition-all ${idx === 1 ? 'md:-translate-y-4 md:border-[#3B82F6]/20' : ''}`}
            >
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-black mb-6 border-2 border-white/5 relative" style={{ color: player.avatarColor }}>
                <span className="opacity-20 absolute inset-0 rounded-full blur-xl" style={{ backgroundColor: player.avatarColor }}></span>
                <span className="relative">#{player.rank}</span>
              </div>
              <h3 className="text-xl font-black text-white mb-6 uppercase tracking-tight">{player.username}</h3>
              <div className="grid grid-cols-3 w-full gap-4 text-center">
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Wins</p>
                  <p className="text-lg font-black text-white">{player.wins}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Earned</p>
                  <p className="text-lg font-black text-white">{player.earned}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Streak</p>
                  <p className="text-lg font-black text-white">{player.streak}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Rankings List */}
        <div className="bg-[#0B1121]/40 border border-white/10 rounded-3xl overflow-hidden p-4 md:p-8">
          <div className="flex items-center justify-between mb-10 px-4">
            <h2 className="text-xl font-black uppercase tracking-tight text-white">Rankings</h2>
            <div className="flex items-center gap-4">
              <button className="flex items-center gap-2 px-4 py-2 bg-[#3B82F6] rounded-lg text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/20">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
                Wins
              </button>
              <button className="flex items-center gap-2 px-4 py-2 text-gray-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg>
                Earnings
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {MOCK_PLAYERS.map((player) => (
              <div 
                key={player.username}
                className="bg-[#1A232E]/30 hover:bg-[#1A232E]/50 border border-white/5 hover:border-white/10 rounded-2xl p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-6 transition-all group"
              >
                <div className="flex items-center gap-6 w-full md:w-auto">
                  <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-sm font-black text-white/50 group-hover:text-[#3B82F6] transition-colors" style={{ backgroundColor: `${player.avatarColor}15` }}>
                    {player.rank}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: player.avatarColor }}>
                      <span className="text-white font-black text-sm uppercase">{player.username.charAt(0)}</span>
                    </div>
                    <div>
                      <h4 className="font-black text-white uppercase tracking-tight">{player.username}</h4>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-8 md:gap-16 w-full md:w-auto">
                  <div className="text-center md:text-left">
                    <p className="text-lg font-black text-white leading-tight">{player.wins}</p>
                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Wins</p>
                  </div>
                  <div className="text-center md:text-left">
                    <p className="text-lg font-black text-white leading-tight">{player.earned} GVT</p>
                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Earned</p>
                  </div>
                  <div className="text-center md:text-left">
                    <p className="text-lg font-black text-white leading-tight">{player.streak}</p>
                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Streak</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
