"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import StakeSelection from "@/components/StakeSelection";
import Matchmaking from "@/components/Matchmaking";

type FilterType = "All" | "Solo" | "1v1";

type Game = {
  slug: string;
  title: string;
  description: string;
  modes: FilterType[];
  image: string;
  available: boolean;
};

const GAMES: Game[] = [
  {
    slug: "snake",
    title: "Snake",
    description: "Classic snake game. Eat food, grow longer, avoid walls!",
    modes: ["Solo", "1v1"],
    image: "/snake.png",
    available: true,
  },
  {
    slug: "chess",
    title: "Chess",
    description: "The ultimate strategy game. Outthink your opponent.",
    modes: ["1v1"],
    image: "/tetris.png",
    available: true,
  },
  {
    slug: "checkers",
    title: "Checkers",
    description: "Classic board game for two players. Capture all enemy pieces to win!",
    modes: ["Solo", "1v1"],
    image: "/bounce.png",
    available: true,
  },
  {
    slug: "jumping-jack",
    title: "Jumping Jack",
    description: "Jump between platforms. How high can you climb?",
    modes: ["Solo", "1v1"],
    image: "/jumping-jack.png",
    available: false,
  },
  {
    slug: "bounce",
    title: "Bounce",
    description: "Keep the ball bouncing. Avoid obstacles!",
    modes: ["Solo", "1v1"],
    image: "/bounce.png",
    available: false,
  },
  {
    slug: "tetris",
    title: "Tetris",
    description: "Stack blocks, clear lines, beat your score!",
    modes: ["Solo", "1v1"],
    image: "/tetris.png",
    available: false,
  },
];

const FILTERS: FilterType[] = ["All", "Solo", "1v1"];

function GameCard({ 
  game, 
  onSelect1v1 
}: { 
  game: Game;
  onSelect1v1: (game: Game) => void;
}) {
  return (
    <div className="group flex flex-col bg-[#0d1326] rounded-2xl border border-white/[0.07] overflow-hidden hover:border-blue-500/25 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-950/50">
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={game.image}
          alt={game.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {!game.available && (
          <div className="absolute inset-0 bg-[#0d1326]/70 flex items-center justify-center">
            <span className="px-4 py-1.5 rounded-full bg-white/10 border border-white/15 text-white text-[11px] font-black uppercase tracking-widest backdrop-blur-sm">
              Coming Soon
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col gap-2.5 p-4 flex-1">
        {/* Title + mode badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-[15px] font-black text-white">{game.title}</h2>
          {game.modes.map((m) => (
            <span
              key={m}
              className="px-2.5 py-0.5 rounded-full border border-[#00d2ff]/25 bg-[#00d2ff]/[0.06] text-[#00d2ff] text-[10px] font-black uppercase tracking-wide"
            >
              {m}
            </span>
          ))}
        </div>

        {/* Description */}
        <p className="text-gray-500 text-[12px] leading-relaxed flex-1">
          {game.description}
        </p>

        {/* Buttons */}
        <div className="flex items-center gap-2 mt-1">
          {game.available ? (
            <>
              <Link
                href={`/games/${game.slug}`}
                className="flex-1 py-2.5 rounded-xl bg-olos-blue hover:bg-olos-cobalt text-white text-[12px] font-black text-center transition-all active:scale-95 shadow-md shadow-blue-900/30"
              >
                Practice
              </Link>
              <button 
                onClick={() => onSelect1v1(game)}
                className="flex-1 py-2.5 rounded-xl bg-[#161e36] hover:bg-[#1d2848] border border-blue-500/20 hover:border-blue-500/40 text-white text-[12px] font-black text-center transition-all active:scale-95"
              >
                1v1 Match
              </button>
            </>
          ) : (
            <>
              <button
                disabled
                className="flex-1 py-2.5 rounded-xl bg-white/[0.04] text-gray-600 text-[12px] font-black text-center border border-white/[0.05] cursor-not-allowed"
              >
                Practice
              </button>
              <button
                disabled
                className="flex-1 py-2.5 rounded-xl bg-white/[0.04] text-gray-600 text-[12px] font-black text-center border border-white/[0.05] cursor-not-allowed"
              >
                1v1 Match
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GamesScreen() {
  const [filter, setFilter] = useState<FilterType>("All");
  const [selectedGameForStake, setSelectedGameForStake] = useState<Game | null>(null);
  const [matchmakingActive, setMatchmakingActive] = useState(false);
  const [activeStake, setActiveStake] = useState(0);

  const visible = GAMES.filter(
    (g) => filter === "All" || g.modes.includes(filter)
  );

  const handleStartMatch = (stake: number) => {
    setActiveStake(stake);
    setMatchmakingActive(true);
  };

  const handleMatchmakingComplete = () => {
    alert(`Game starting now for ${selectedGameForStake?.title}!`);
    // Future: redirect to the actual game page with 1v1 config
    location.href = `/games/${selectedGameForStake?.slug}?mode=1v1&stake=${activeStake}`;
  };

  console.log("[GamesScreen] State:", { matchmakingActive, selectedGame: selectedGameForStake?.slug });

  return (
    <main className="min-h-screen bg-[#0B1121] text-white">
      <Navbar />

      <div className="max-w-[1567px] mx-auto px-8 lg:px-16 pt-32 pb-28">

        {matchmakingActive && selectedGameForStake ? (
          <div className="flex flex-col items-center">
            <Matchmaking 
              game={selectedGameForStake}
              stake={activeStake}
              winnerReceives={activeStake * 2 * 0.9}
              onCancel={() => setMatchmakingActive(false)}
              onComplete={handleMatchmakingComplete}
            />
          </div>
        ) : selectedGameForStake ? (
          <div className="flex flex-col items-center animate-fade-in">
             <div className="w-full max-w-[560px] mb-8">
              <button 
                onClick={() => setSelectedGameForStake(null)}
                className="text-gray-500 hover:text-white transition-colors text-sm font-bold flex items-center gap-2"
              >
                <span>←</span> Back to Games
              </button>
            </div>
            <StakeSelection 
              game={selectedGameForStake} 
              onBack={() => setSelectedGameForStake(null)}
              onStart={handleStartMatch}
            />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-6 mb-8">
              <div>
                <p className="text-[#00d2ff] text-[11px] font-black uppercase tracking-[0.4em] mb-2">
                  Olos Gaming
                </p>
                <h1 className="text-5xl font-black tracking-tight text-white leading-none">
                  Games
                </h1>
                <p className="text-gray-500 text-sm font-medium mt-2">
                  Choose a game to play or compete
                </p>
              </div>

              {/* Filter toggle */}
              <div className="sm:ml-auto flex items-center gap-1 bg-white/[0.04] border border-white/[0.07] rounded-xl p-1">
                {FILTERS.map((f) => {
                  const active = filter === f;
                  return (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-5 py-2 rounded-lg text-[13px] font-black uppercase tracking-wide transition-all duration-200 ${
                        active
                          ? "bg-olos-blue text-white shadow-lg shadow-blue-900/40"
                          : "text-gray-400 hover:text-white hover:bg-white/[0.06]"
                      }`}
                    >
                      {f}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live matches bar */}
            <div className="flex items-center gap-4 px-5 py-3.5 rounded-xl border border-[#00d2ff]/15 bg-[#00d2ff]/[0.04] mb-10">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-[#00d2ff] shrink-0">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span className="text-white text-[13px] font-black">Live matches:</span>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { name: "Snake", count: 24, color: "#22c55e" },
                  { name: "Chess", count: 18, color: "#3b82f6" },
                  { name: "Checkers", count: 12, color: "#f87171" },
                ].map((m) => (
                  <span
                    key={m.name}
                    className="px-3 py-0.5 rounded-full border text-[12px] font-black"
                    style={{ color: m.color, borderColor: `${m.color}40` }}
                  >
                    {m.name} ({m.count})
                  </span>
                ))}
              </div>
              <span className="ml-auto flex items-center gap-1.5 text-[11px] font-bold text-[#00d2ff]/60">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00d2ff] animate-pulse" />
                Live
              </span>
            </div>

            {/* Game Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 animate-fade-in-up">
              {visible.map((game) => (
                <GameCard 
                  key={game.slug} 
                  game={game} 
                  onSelect1v1={(g) => setSelectedGameForStake(g)}
                />
              ))}
            </div>

            <p className="text-center text-gray-700 text-xs font-bold uppercase tracking-widest mt-16">
              More games coming soon ·{" "}
              <Link href="/" className="hover:text-white transition-colors">
                Back to Home
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
