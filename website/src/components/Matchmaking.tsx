"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useWallet } from "@/context/WalletContext";
import { useAuth } from "@/context/AuthContext";

type MatchmakingState = "SEARCHING" | "FOUND" | "WAITING" | "COUNTDOWN";

interface MatchmakingProps {
  game: {
    slug: string;
    title: string;
  };
  stake: number;
  winnerReceives: number;
  onCancel: () => void;
  onReady?: () => void;
  onComplete?: (matchId: string) => void;
}

export default function Matchmaking({
  game,
  stake,
  winnerReceives,
  onCancel,
  onReady,
  onComplete,
}: MatchmakingProps) {
  const { user, isLoading: authLoading } = useAuth();
  const { balance, refreshBalance } = useWallet();
  console.log("[Matchmaking] Component Rendered", { game: game.slug, stake });
  const [state, setState] = useState<MatchmakingState>("SEARCHING");
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(10);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [opponent, setOpponent] = useState<{ id: string; username: string } | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      console.warn("[Matchmaking] No user found - is the user logged in?");
      setError("You must be logged in to play 1v1");
    } else {
      console.log("[Matchmaking] User validated from context:", user.id);
    }
  }, [user, authLoading]);

  useEffect(() => {
    console.log("[Matchmaking] Effect trigger, user state:", user?.id || "null");
    if (!user) return;

    let channel: any;

    const startMatchmaking = async () => {
      if (state !== "SEARCHING") return;
      
      console.log(`[Matchmaking] Starting for ${game.slug}, user: ${user.id}`);
      setError(null);

      // 1. Subscribe to Realtime FIRST
      subscribeToMatches(user.id);

      // 2. Call RPC (Postgres Function)
      try {
        console.log(`[Matchmaking] Invoking find_opponent RPC...`);
        const { data, error: rpcError } = await supabase.rpc('find_opponent', {
          p_user_id: user.id,
          p_game_type: game.slug,
          p_stake_amount: stake
        });

        if (rpcError) throw rpcError;
        
        console.log(`[Matchmaking] RPC response:`, data);

        if (data.status === 'matched') {
          console.log(`[Matchmaking] Instant match! ID: ${data.match_id}`);
          setMatchId(data.match_id);
          setState("FOUND");
          fetchMatchDetails(data.match_id, user.id);
        } else if (data.status === 'searching') {
          console.log(`[Matchmaking] No instant match, waiting in queue...`);
        } else if (data.error) {
          throw new Error(data.error);
        }
      } catch (err: any) {
        console.error("[Matchmaking] Init Error:", err.message);
        // Explicitly handle "Insufficient balance" with the back button we added
        setError(err.message);
      }
    };

    const subscribeToMatches = (userId: string) => {
      console.log(`[Matchmaking] Subscribing to matches for user: ${userId}`);
      channel = supabase
        .channel(`matchmaking:${userId}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'matches'
        }, (payload) => {
          console.log(`[Matchmaking] New match event received!`, payload.new);
          // Check if we are part of this new match
          if (payload.new.player1_id === userId || payload.new.player2_id === userId) {
            console.log(`[Matchmaking] Match confirmed via Realtime!`);
            handleMatchFound(payload.new, userId);
          }
        })
        .subscribe((status) => {
          console.log(`[Matchmaking] Subscription status: ${status}`);
        });
    };

    const handleMatchFound = (match: any, userId: string) => {
      setMatchId(match.id);
      setState("FOUND");
      fetchMatchDetails(match.id, userId);
    };

    const fetchMatchDetails = async (id: string, userId: string) => {
      console.log(`[Matchmaking] Fetching details for match: ${id}`);
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .eq('id', id)
        .single();
      
      if (matchData) {
        const opponentId = matchData.player1_id === userId ? matchData.player2_id : matchData.player1_id;
        console.log(`[Matchmaking] Opponent identified: ${opponentId}`);
        
        // Fetch opponent profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', opponentId)
          .single();

        setOpponent({ 
          id: opponentId, 
          username: profileData?.username || `Challenger ${opponentId.slice(0, 5)}` 
        });
      } else if (matchError) {
        console.error(`[Matchmaking] Detail fetch failed:`, matchError.message);
      }
    };

    startMatchmaking();

    const handleUnload = () => {
      if (user && state === "SEARCHING") {
        supabase.rpc("cancel_matchmaking", { p_user_id: user.id });
      }
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      if (channel) {
        console.log(`[Matchmaking] Cleaning up channel`);
        supabase.removeChannel(channel);
      }
      // Cleanup: Refund if unmounting during SEARCHING
      if (user && state === "SEARCHING") {
        supabase.rpc('cancel_matchmaking', { p_user_id: user.id });
      }
    };
  }, [game.slug, stake, user, state]);

  const handleCancel = async () => {
    console.log("[Matchmaking] Cancelling search...");
    if (user) {
      await supabase.rpc('cancel_matchmaking', { p_user_id: user.id });
      await refreshBalance(); // Update UI immediately
    }
    onCancel();
  };

  // Subscribe to match events for "Ready" status
  useEffect(() => {
    if (!matchId || !user) return;

    console.log(`[Matchmaking] Listening for ready events in match: ${matchId}`);
    
    // Check if opponent is ALREADY ready
    supabase
      .from('match_events')
      .select('player_id')
      .eq('match_id', matchId)
      .eq('event_type', 'ready')
      .neq('player_id', user.id)
      .then(({ data }) => {
        if (data && data.length > 0) {
          console.log(`[Matchmaking] Opponent was already ready!`);
          setOpponentReady(true);
        }
      });

    const channel = supabase
      .channel(`match_events:${matchId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'match_events',
        filter: `match_id=eq.${matchId}`
      }, (payload) => {
        console.log(`[Matchmaking] Match event: ${payload.new.event_type}`);
        if (payload.new.event_type === 'ready') {
          if (payload.new.player_id !== user.id) {
            console.log(`[Matchmaking] Opponent is ready!`);
            setOpponentReady(true);
          }
        }
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        console.log("[Matchmaking] Someone left:", leftPresences);
        // If we were in a match-related state and someone leaves, we return to search
        if (state !== "SEARCHING") {
          console.warn("[Matchmaking] Opponent disconnected! Returning to search...");
          setMatchId(null);
          setOpponent(null);
          setPlayerReady(false);
          setOpponentReady(false);
          setState("SEARCHING");
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log("[Matchmaking] Subscribed to match events, tracking presence...");
          await channel.track({ user_id: user.id, online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, user]);

  // Effect for WAITING -> COUNTDOWN transition
  useEffect(() => {
    if (playerReady && opponentReady && matchId) {
      const syncCountdown = async () => {
        const { data } = await supabase
          .from('match_events')
          .select('created_at')
          .eq('match_id', matchId)
          .eq('event_type', 'ready')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (data) {
          const startTime = new Date(data.created_at).getTime();
          const now = new Date().getTime();
          const elapsed = Math.floor((now - startTime) / 1000);
          setCountdown(Math.max(1, 10 - elapsed));
        }
        setState("COUNTDOWN");
      };
      
      syncCountdown();
    }
  }, [playerReady, opponentReady, matchId]);

  // Handle countdown timer
  useEffect(() => {
    if (state !== "COUNTDOWN") return;

    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      onComplete?.(matchId!);
    }
  }, [state, countdown, onComplete, matchId]);

  const handleReady = async () => {
    if (!user || !matchId) return;

    // Send "ready" event
    await supabase.from('match_events').insert({
      match_id: matchId,
      player_id: user.id,
      event_type: 'ready'
    });

    setPlayerReady(true);
    setState("WAITING");
    onReady?.();
  };

  return (
    <div className="w-full max-w-[700px] aspect-[4/3] bg-[#0d1326] rounded-3xl border border-white/10 p-8 flex flex-col items-center justify-between shadow-2xl relative overflow-hidden">
      {/* Background patterns */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#3b82f6,transparent_70%)]" />
      </div>

      {/* Header Text */}
      <div className="text-center z-10">
        <h2 className={`text-xl font-black tracking-tight ${error ? 'text-red-500' : 'text-white'}`}>
          {error ? "Matchmaking Failed" : (
            state === "SEARCHING" ? "Finding Opponent...." :
            state === "FOUND" ? "Opponent found!" :
            "Match Starting!"
          )}
        </h2>
        {error && <p className="text-xs font-bold text-red-400/80 mt-1 uppercase tracking-widest">{error}</p>}
      </div>

      {/* Versus Section */}
      <div className="flex items-center justify-center gap-16 z-10 w-full">
        {/* Player */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-24 h-24 rounded-full bg-blue-500 flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.3)]">
            <span className="text-3xl font-black text-white">P</span>
          </div>
          <span className="text-xs font-black text-white uppercase tracking-wider">You</span>
        </div>

        {/* VS or Spinner/Countdown */}
        <div className="relative">
          {state !== "WAITING" && state !== "COUNTDOWN" && (
            <span className="text-4xl font-black text-gray-700 uppercase tracking-tighter">VS</span>
          )}
          {state === "WAITING" && (
            <div className="w-16 h-16 border-4 border-white/5 border-t-blue-500 rounded-full animate-spin" />
          )}
          {state === "COUNTDOWN" && (
            <div className="flex flex-col items-center">
              <span className="text-7xl font-black text-white leading-none">
                {countdown}<span className="text-blue-500">s</span>
              </span>
            </div>
          )}
        </div>

        {/* Opponent */}
        <div className="flex flex-col items-center gap-4">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
            state === "SEARCHING" 
              ? "bg-white/5 border-white/10" 
              : "bg-gray-700 border-transparent shadow-[0_0_30px_rgba(55,65,81,0.3)]"
          }`}>
            {state === "SEARCHING" ? (
              <svg className="w-8 h-8 text-white/20 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <span className="text-3xl font-black text-white">C</span>
            )}
          </div>
          <span className="text-xs font-black text-gray-500 uppercase tracking-wider">
            {state === "SEARCHING" ? "Searching" : (opponent?.username || "Challenger")}
          </span>
        </div>
      </div>

      {/* Status Message */}
      {(state === "WAITING" || state === "COUNTDOWN") && (
        <div className="text-center z-10 px-4">
          <p className="text-sm font-bold text-gray-400">
            {state === "WAITING" && "Waiting for the challenger to be ready!"}
            {state === "COUNTDOWN" && "Challenger is ready! Game starts in " + countdown + "s"}
          </p>
        </div>
      )}

      {/* Info Card */}
      <div className="w-full max-w-[500px] bg-blue-900/10 border border-blue-500/10 rounded-2xl p-6 z-10">
        <div className="space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500 font-bold uppercase tracking-widest">Game</span>
            <span className="text-white font-black">{game.title}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500 font-bold uppercase tracking-widest">Stake</span>
            <span className="text-white font-black">{stake} GVT</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-xs font-bold uppercase tracking-widest">Winner receives</span>
            <span className="text-[#00d2ff] text-xl font-black">{winnerReceives} GVT</span>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="w-full max-w-[500px] z-10">
        {error ? (
          <button
            onClick={error.toLowerCase().includes("balance") ? onCancel : () => window.location.reload()}
            className="w-full py-4 rounded-xl bg-red-600/20 border border-red-500/30 hover:bg-red-600/30 text-red-500 text-sm font-black transition-all active:scale-95"
          >
            {error.toLowerCase().includes("balance") ? "Back to Stake" : "Try Again"}
          </button>
        ) : (
          <>
            {state === "SEARCHING" && (
              <button
                onClick={handleCancel}
                className="w-full py-4 rounded-xl border border-white/10 hover:bg-white/5 text-white text-sm font-black transition-all active:scale-95"
              >
                Cancel
              </button>
            )}
            {state === "FOUND" && (
              <button
                onClick={handleReady}
                className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-black transition-all active:scale-95 shadow-[0_0_20px_rgba(37,99,235,0.4)] flex items-center justify-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Ready
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
