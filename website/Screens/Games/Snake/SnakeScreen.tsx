"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

const COLS = 20;
const ROWS = 20;
const CELL = 24;
const W = COLS * CELL;
const H = ROWS * CELL;

type Dir = "UP" | "DOWN" | "LEFT" | "RIGHT";
type Pos = { x: number; y: number };

function rnd(max: number) {
  return Math.floor(Math.random() * max);
}

export default function SnakeScreen() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") || "Solo";
  const matchId = searchParams.get("matchId");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    snake: [{ x: 10, y: 10 }] as Pos[],
    dir: "RIGHT" as Dir,
    nextDir: "RIGHT" as Dir,
    food: { x: 15, y: 10 } as Pos,
    score: 0,
    alive: true,
    started: false,
    opponentScore: 0,
    p1_time: 600,
    p2_time: 600,
  });

  const [score, setScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [p1Time, setP1Time] = useState(600);
  const [p2Time, setP2Time] = useState(600);
  const [alive, setAlive] = useState(true);
  const [started, setStarted] = useState(false);
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMatchState = useCallback(async () => {
    if (!matchId) return;
    const { data } = await supabase.from('matches').select('*').eq('id', matchId).single();
    if (data) {
      const s = stateRef.current;
      s.food = data.current_apple_pos;
      s.score = data.player1_score; // Needs to be context aware
      s.opponentScore = data.player2_score;
      s.p1_time = data.player1_time_remaining;
      s.p2_time = data.player2_time_remaining;
      setScore(s.score);
      setOpponentScore(s.opponentScore);
      setP1Time(s.p1_time);
      setP2Time(s.p2_time);
    }
  }, [matchId]);

  useEffect(() => {
    if (mode === '1v1' && matchId) {
      fetchMatchState();

      // Subscribe to match updates
      const channel = supabase
        .channel(`game:${matchId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, (payload) => {
          const s = stateRef.current;
          s.food = payload.new.current_apple_pos;
          s.score = payload.new.player1_score; 
          s.opponentScore = payload.new.player2_score;
          s.p1_time = payload.new.player1_time_remaining;
          s.p2_time = payload.new.player2_time_remaining;
          setScore(s.score);
          setOpponentScore(s.opponentScore);
          setP1Time(s.p1_time);
          setP2Time(s.p2_time);

          if (payload.new.status === 'finished') {
            s.alive = false;
            setAlive(false);
          }
        })
        .subscribe();

      // Periodic timer tick call (Phase 4B)
      const tickTimer = setInterval(async () => {
        await supabase.functions.invoke('game_tick', { body: { match_id: matchId } });
      }, 5000);

      return () => {
        supabase.removeChannel(channel);
        clearInterval(tickTimer);
      };
    }
  }, [mode, matchId, fetchMatchState]);

  const randomFood = useCallback((snake: Pos[]): Pos => {
    let f: Pos;
    do {
      f = { x: rnd(COLS), y: rnd(ROWS) };
    } while (snake.some((s) => s.x === f.x && s.y === f.y));
    return f;
  }, []);

  const reset = useCallback(() => {
    if (mode === '1v1') return; // Cannot manual reset in 1v1
    const s = stateRef.current;
    s.snake = [{ x: 10, y: 10 }];
    s.dir = "RIGHT";
    s.nextDir = "RIGHT";
    s.food = randomFood(s.snake);
    s.score = 0;
    s.alive = true;
    s.started = true;
    setScore(0);
    setAlive(true);
    setStarted(true);
  }, [randomFood, mode]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const s = stateRef.current;

    // BG
    ctx.fillStyle = "#070d1a";
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    for (let x = 0; x < COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL, 0);
      ctx.lineTo(x * CELL, H);
      ctx.stroke();
    }
    for (let y = 0; y < ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL);
      ctx.lineTo(W, y * CELL);
      ctx.stroke();
    }

    // Snake
    s.snake.forEach((seg, i) => {
      const g = ctx.createRadialGradient(
        seg.x * CELL + CELL / 2,
        seg.y * CELL + CELL / 2,
        0,
        seg.x * CELL + CELL / 2,
        seg.y * CELL + CELL / 2,
        CELL / 2
      );
      if (i === 0) {
        g.addColorStop(0, "#4ade80");
        g.addColorStop(1, "#16a34a");
      } else {
        const t = i / s.snake.length;
        g.addColorStop(0, `hsl(${140 - t * 30},70%,${55 - t * 15}%)`);
        g.addColorStop(1, `hsl(${140 - t * 30},70%,${35 - t * 10}%)`);
      }
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(seg.x * CELL + 2, seg.y * CELL + 2, CELL - 4, CELL - 4, 6);
      ctx.fill();
    });

    // Food
    const fx = s.food.x * CELL + CELL / 2;
    const fy = s.food.y * CELL + CELL / 2;
    const gf = ctx.createRadialGradient(fx, fy, 0, fx, fy, CELL / 2);
    gf.addColorStop(0, "#f87171");
    gf.addColorStop(1, "#dc2626");
    ctx.fillStyle = gf;
    ctx.beginPath();
    ctx.arc(fx, fy, CELL / 2 - 3, 0, Math.PI * 2);
    ctx.fill();
    // shine
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath();
    ctx.arc(fx - 3, fy - 3, 3, 0, Math.PI * 2);
    ctx.fill();

    // Game Over overlay
    if (!s.alive && s.started) {
      ctx.fillStyle = "rgba(7,13,26,0.82)";
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "center";
      ctx.fillStyle = "#f87171";
      ctx.font = "bold 32px Consolas, monospace";
      ctx.fillText("GAME OVER", W / 2, H / 2 - 20);
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "bold 16px Consolas, monospace";
      ctx.fillText(`Final Score: ${s.score}`, W / 2, H / 2 + 14);
    }

    // Start screen
    if (!s.started) {
      ctx.fillStyle = "rgba(7,13,26,0.7)";
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "center";
      ctx.fillStyle = "#4ade80";
      ctx.font = "bold 26px Consolas, monospace";
      ctx.fillText(mode === '1v1' ? "GET READY!" : "SNAKE", W / 2, H / 2 - 16);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 13px Consolas, monospace";
      ctx.fillText(mode === '1v1' ? "Game starts in a few seconds..." : "Press SPACE or click Start", W / 2, H / 2 + 18);
    }
  }, [mode]);

  const tick = useCallback(async () => {
    const s = stateRef.current;
    if (!s.alive || (!s.started && mode !== '1v1')) return;

    // Auto-start 1v1 if not started
    if (mode === '1v1' && !s.started) {
       s.started = true;
       setStarted(true);
    }

    s.dir = s.nextDir;
    const head = s.snake[0];
    let nx = head.x;
    let ny = head.y;
    if (s.dir === "UP") ny--;
    if (s.dir === "DOWN") ny++;
    if (s.dir === "LEFT") nx--;
    if (s.dir === "RIGHT") nx++;

    // Wall collision
    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) {
      s.alive = false;
      setAlive(false);
      draw();
      // Future: send death event to server
      return;
    }
    // Self collision
    if (s.snake.some((seg) => seg.x === nx && seg.y === ny)) {
      s.alive = false;
      setAlive(false);
      draw();
      return;
    }

    const ate = nx === s.food.x && ny === s.food.y;
    s.snake = [{ x: nx, y: ny }, ...s.snake];
    
    if (!ate) {
      s.snake.pop();
    } else {
      if (mode === 'Solo') {
        s.score += 10;
        setScore(s.score);
        s.food = randomFood(s.snake);
      } else {
        // 1v1: Validate with server
        const { data: { user } } = await supabase.auth.getUser();
        if (user && matchId) {
          await supabase.rpc('validate_apple_eaten', {
            p_match_id: matchId,
            p_player_id: user.id,
            p_x: nx,
            p_y: ny
          });
        }
      }
    }

    draw();
  }, [draw, randomFood, mode, matchId]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const speed = Math.max(80, 160 - Math.floor(score / 50) * 10);
    if (loopRef.current) clearInterval(loopRef.current);
    loopRef.current = setInterval(tick, speed);
    return () => {
      if (loopRef.current) clearInterval(loopRef.current);
    };
  }, [tick, score]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (e.code === "Space") {
        e.preventDefault();
        if (!s.started || !s.alive) reset();
        return;
      }
      const map: Record<string, Dir> = {
        ArrowUp: "UP",
        KeyW: "UP",
        ArrowDown: "DOWN",
        KeyS: "DOWN",
        ArrowLeft: "LEFT",
        KeyA: "LEFT",
        ArrowRight: "RIGHT",
        KeyD: "RIGHT",
      };
      const d = map[e.code];
      if (!d) return;
      const opp: Record<Dir, Dir> = {
        UP: "DOWN",
        DOWN: "UP",
        LEFT: "RIGHT",
        RIGHT: "LEFT",
      };
      if (opp[d] !== s.dir) s.nextDir = d;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reset]);

  return (
    <div className="min-h-screen bg-[#0B1121] text-white">
      <Navbar />
      <div className="flex flex-col items-center pt-28 pb-16 px-4 gap-6">
        {/* Title Bar */}
        <div className="flex items-center gap-4 w-full max-w-[560px]">
          <Link
            href="/games"
            className="text-gray-500 hover:text-white transition-colors text-sm font-bold"
          >
            ← Games
          </Link>
          <h1 className="text-2xl font-black text-white">🐍 Snake</h1>
          <span className={`ml-auto border text-[11px] font-black uppercase px-3 py-0.5 rounded-full ${
            mode === '1v1' 
              ? "bg-blue-500/10 border-blue-500/30 text-blue-400" 
              : "bg-green-500/10 border-green-500/30 text-green-400"
          }`}>
            {mode}
          </span>
        </div>

        {/* 1v1 Stats Bar */}
        {mode === '1v1' && (
          <div className="grid grid-cols-2 gap-4 w-full max-w-[560px] bg-[#0d1326] border border-white/5 p-4 rounded-xl">
            <div className="flex flex-col gap-1 border-r border-white/5">
              <span className="text-[10px] font-black uppercase text-gray-500">You</span>
              <div className="flex items-center justify-between pr-4">
                <span className="text-2xl font-black text-green-400">{score}</span>
                <span className={`text-xs font-mono font-bold ${p1Time < 60 ? 'text-red-500 animate-pulse' : 'text-gray-400'}`}>
                  {Math.floor(p1Time / 60)}:{(p1Time % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-1 pl-2">
              <span className="text-[10px] font-black uppercase text-gray-500">Challenger</span>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-blue-400">{opponentScore}</span>
                <span className={`text-xs font-mono font-bold ${p2Time < 60 ? 'text-red-500 animate-pulse' : 'text-gray-400'}`}>
                   {Math.floor(p2Time / 60)}:{(p2Time % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Solo Score bar */}
        {mode === 'Solo' && (
          <div className="flex items-center gap-6 w-full max-w-[560px]">
            <div className="flex flex-col">
              <span className="text-[11px] font-black uppercase text-gray-500 tracking-widest">Score</span>
              <span className="text-3xl font-black text-green-400">{score}</span>
            </div>
            <button
              onClick={reset}
              className="ml-auto px-5 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-bold transition-all active:scale-95"
            >
              Restart
            </button>
          </div>
        )}

        {/* Canvas */}
        <div className="rounded-2xl overflow-hidden border border-green-500/20 shadow-2xl shadow-green-900/20">
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="block"
            onClick={() => {
              const s = stateRef.current;
              if (!s.started || !s.alive) reset();
            }}
            style={{ imageRendering: "pixelated" }}
          />
        </div>

        {/* Controls */}
        <div className="text-gray-500 text-xs font-bold text-center space-y-1">
          <p>Arrow Keys / WASD to move · SPACE to start / restart</p>
        </div>
      </div>
    </div>
  );
}
