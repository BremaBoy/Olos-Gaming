"use client";

import { useState } from "react";

type Game = {
  slug: string;
  title: string;
  description: string;
  image: string;
};

interface StakeSelectionProps {
  game: Game;
  onBack: () => void;
  onStart: (stake: number) => void;
}

const STAKE_OPTIONS = [10, 50, 100, 500];
const FEE_PERCENTAGE = 0.1; // 10%

export default function StakeSelection({ game, onBack, onStart }: StakeSelectionProps) {
  const [selectedStake, setSelectedStake] = useState(STAKE_OPTIONS[1]);

  const totalPot = selectedStake * 2;
  const platformFee = totalPot * FEE_PERCENTAGE;
  const winnerReceives = totalPot - platformFee;

  return (
    <div className="w-full max-w-[560px] mx-auto animate-fade-in-up">
      {/* Game Info Header */}
      <div className="bg-[#0d1326] rounded-2xl border border-white/[0.07] p-4 mb-5 flex items-center gap-4">
        <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-white/10">
          <img src={game.image} alt={game.title} className="w-full h-full object-cover" />
        </div>
        <div>
          <h2 className="text-lg font-black text-white">{game.title}</h2>
          <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">{game.description}</p>
        </div>
      </div>

      {/* Stake Selection Section */}
      <div className="bg-[#0d1326] rounded-2xl border border-white/[0.07] p-6 mb-5">
        <div className="mb-6">
          <h3 className="text-sm font-black text-white mb-1">Select Stake</h3>
          <p className="text-gray-500 text-[11px] font-bold uppercase tracking-wider">Choose how much BVT you want to wager</p>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-8">
          {STAKE_OPTIONS.map((stake) => (
            <button
              key={stake}
              onClick={() => setSelectedStake(stake)}
              className={`py-3.5 rounded-xl text-[13px] font-black transition-all border ${
                selectedStake === stake
                  ? "bg-olos-blue border-transparent text-white shadow-lg shadow-blue-600/20"
                  : "bg-[#161e36] border-white/[0.05] text-gray-400 hover:border-white/10 hover:text-white"
              }`}
            >
              {stake}
            </button>
          ))}
        </div>

        {/* Potential Rewards */}
        <div className="space-y-3 pt-6 border-t border-white/[0.05]">
          <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4">Potential Rewards</h3>
          
          <div className="flex justify-between items-center text-[13px]">
            <span className="text-gray-500 font-bold">Your Stake</span>
            <span className="text-white font-black">{selectedStake} BVT</span>
          </div>
          
          <div className="flex justify-between items-center text-[13px]">
            <span className="text-gray-500 font-bold">Opponent Stake</span>
            <span className="text-white font-black">{selectedStake} BVT</span>
          </div>

          <div className="flex justify-between items-center text-[13px] py-1">
            <span className="text-gray-500 font-bold">Total pot</span>
            <span className="text-white font-black">{totalPot} BVT</span>
          </div>

          <div className="flex justify-between items-center text-[11px] text-gray-600 italic">
            <span>Platform Fee (10%)</span>
            <span>-{platformFee} BVT</span>
          </div>

          <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/[0.05]">
            <span className="text-white font-black">Winner receives</span>
            <span className="text-[#00d2ff] text-lg font-black">{winnerReceives} BVT</span>
          </div>
        </div>
      </div>

      {/* Match Rules */}
      <div className="bg-[#0d1326] rounded-2xl border border-white/[0.07] p-6 mb-8">
        <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4">1v1 Live Match Rules</h3>
        <div className="space-y-4">
          <div>
            <h4 className="text-[10px] font-black text-blue-400 uppercase mb-1.5">Match Duration</h4>
            <p className="text-xs text-gray-500 font-medium">Each match lasts a maximum of 20 minutes, with 10 minutes allocated per player.</p>
          </div>

          <div>
            <h4 className="text-[10px] font-black text-blue-400 uppercase mb-1.5">Disconnects & Network Issues</h4>
            <ul className="space-y-1.5">
              <li className="flex items-start gap-2 text-xs text-gray-500 font-medium">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-blue-500/50 shrink-0" />
                <span>Player exits or cancels = Forfeit & Opponent wins.</span>
              </li>
              <li className="flex items-start gap-2 text-xs text-gray-500 font-medium">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-blue-500/50 shrink-0" />
                <span>Network issues = Match continues until total time expires.</span>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-[10px] font-black text-blue-400 uppercase mb-1.5">Winning Conditions</h4>
            <ul className="space-y-1.5">
              <li className="flex items-start gap-2 text-xs text-gray-500 font-medium">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-blue-500/50 shrink-0" />
                <span>Highest score or last survivor at the end wins.</span>
              </li>
              <li className="flex items-start gap-2 text-xs text-gray-500 font-medium">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-blue-500/50 shrink-0" />
                <span>Same score at timeout = Pot split evenly (minus 10% fee).</span>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-[10px] font-black text-blue-400 uppercase mb-1.5">Action Time Limit</h4>
            <p className="text-xs text-gray-500 font-medium">No specific time limit per move; only the 10-minute player clock applies.</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="flex-1 py-4 rounded-xl bg-[#161e36] hover:bg-[#1d2848] border border-blue-500/10 hover:border-blue-500/30 text-white text-sm font-black transition-all active:scale-95"
        >
          Back
        </button>
        <button
          onClick={() => onStart(selectedStake)}
          className="flex-[1.5] py-4 rounded-xl bg-olos-blue hover:bg-olos-cobalt text-white text-sm font-black transition-all active:scale-95 shadow-xl shadow-blue-900/30"
        >
          Start Match
        </button>
      </div>
    </div>
  );
}
