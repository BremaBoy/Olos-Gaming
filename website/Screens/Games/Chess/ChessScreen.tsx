"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Matchmaking from "@/components/Matchmaking";

// ── Constants ─────────────────────────────────────────────────────────────────
const SQ = 68; // square size in px
const W = SQ * 8;
const H = SQ * 8;

type Color = "w" | "b";
type PieceType = "K" | "Q" | "R" | "B" | "N" | "P";
type Piece = { type: PieceType; color: Color };
type Board = (Piece | null)[][];
type Sq = [number, number]; // [row, col]

// Piece glyphs
const GLYPHS: Record<Color, Record<PieceType, string>> = {
  w: { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙" },
  b: { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" },
};

// ── Board helpers ─────────────────────────────────────────────────────────────
function emptyBoard(): Board {
  return Array.from({ length: 8 }, () => Array(8).fill(null));
}

function initialBoard(): Board {
  const b = emptyBoard();
  const back: PieceType[] = ["R", "N", "B", "Q", "K", "B", "N", "R"];
  for (let c = 0; c < 8; c++) {
    b[0][c] = { type: back[c], color: "b" };
    b[1][c] = { type: "P", color: "b" };
    b[6][c] = { type: "P", color: "w" };
    b[7][c] = { type: back[c], color: "w" };
  }
  return b;
}

function opp(c: Color): Color {
  return c === "w" ? "b" : "w";
}

function inBounds(r: number, c: number) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

// Generate pseudo-legal moves (no check detection for simplicity)
function rawMoves(board: Board, r: number, c: number): Sq[] {
  const piece = board[r][c];
  if (!piece) return [];
  const { type, color } = piece;
  const moves: Sq[] = [];

  const slide = (dr: number, dc: number) => {
    let nr = r + dr;
    let nc = c + dc;
    while (inBounds(nr, nc)) {
      const t = board[nr][nc];
      if (t) {
        if (t.color !== color) moves.push([nr, nc]);
        break;
      }
      moves.push([nr, nc]);
      nr += dr;
      nc += dc;
    }
  };

  const step = (dr: number, dc: number) => {
    const nr = r + dr;
    const nc = c + dc;
    if (inBounds(nr, nc) && board[nr][nc]?.color !== color) moves.push([nr, nc]);
  };

  switch (type) {
    case "R":
      [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc]) => slide(dr,dc));
      break;
    case "B":
      [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dr,dc]) => slide(dr,dc));
      break;
    case "Q":
      [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dr,dc]) => slide(dr,dc));
      break;
    case "N":
      [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc]) => step(dr,dc));
      break;
    case "K":
      [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr,dc]) => step(dr,dc));
      break;
    case "P": {
      const dir = color === "w" ? -1 : 1;
      const startRow = color === "w" ? 6 : 1;
      // Forward
      if (inBounds(r + dir, c) && !board[r + dir][c]) {
        moves.push([r + dir, c]);
        if (r === startRow && !board[r + 2 * dir][c]) moves.push([r + 2 * dir, c]);
      }
      // Captures
      [-1, 1].forEach((dc) => {
        const nr = r + dir;
        const nc = c + dc;
        if (inBounds(nr, nc) && board[nr][nc]?.color === opp(color)) moves.push([nr, nc]);
      });
      break;
    }
  }
  return moves;
}

// Simple check: is the given color's king under attack?
function isInCheck(board: Board, color: Color): boolean {
  let kingR = -1, kingC = -1;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c]?.type === "K" && board[r][c]?.color === color) { kingR = r; kingC = c; }
  if (kingR === -1) return true; 
  const enemy = opp(color);
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c]?.color === enemy)
        if (rawMoves(board, r, c).some(([mr,mc]) => mr === kingR && mc === kingC)) return true;
  return false;
}

function applyMove(board: Board, from: Sq, to: Sq): Board {
  const nb = board.map((row) => [...row]);
  const [fr, fc] = from;
  const [tr, tc] = to;
  nb[tr][tc] = nb[fr][fc];
  nb[fr][fc] = null;
  // Pawn promotion
  if (nb[tr][tc]?.type === "P") {
    if (tr === 0 && nb[tr][tc]?.color === "w") nb[tr][tc] = { type: "Q", color: "w" };
    if (tr === 7 && nb[tr][tc]?.color === "b") nb[tr][tc] = { type: "Q", color: "b" };
  }
  return nb;
}

function legalMoves(board: Board, r: number, c: number, color: Color): Sq[] {
  return rawMoves(board, r, c).filter(([tr, tc]) => {
    const nb = applyMove(board, [r, c], [tr, tc]);
    return !isInCheck(nb, color);
  });
}

function allMoves(board: Board, color: Color): [Sq, Sq][] {
  const result: [Sq, Sq][] = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c]?.color === color)
        legalMoves(board, r, c, color).forEach((to) => result.push([[r, c], to]));
  return result;
}

// Very simple AI
const VALUES: Record<PieceType, number> = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 100 };

function aiMove(board: Board): [Sq, Sq] | null {
  const moves = allMoves(board, "b");
  if (!moves.length) return null;
  let best: [Sq, Sq] = moves[0];
  let bestScore = -Infinity;
  for (const [from, to] of moves) {
    const captured = board[to[0]][to[1]];
    const score = captured ? VALUES[captured.type] : 0;
    if (score > bestScore) { bestScore = score; best = [from, to]; }
  }
  if (bestScore === 0) return moves[Math.floor(Math.random() * moves.length)];
  return best;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ChessScreen() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") || "Solo";
  const matchIdParam = searchParams.get("matchId");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [board, setBoard] = useState<Board>(initialBoard);
  const [selected, setSelected] = useState<Sq | null>(null);
  const [highlights, setHighlights] = useState<Sq[]>([]);
  const [turn, setTurn] = useState<Color>("w");
  const [status, setStatus] = useState<"playing" | "checkmate" | "stalemate">("playing");
  const [winner, setWinner] = useState<Color | null>(null);
  const [inCheck, setInCheck] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(matchIdParam);
  const [playerColor, setPlayerColor] = useState<Color>("w");
  const [p1Time, setP1Time] = useState(600);
  const [p2Time, setP2Time] = useState(600);
  const [opponent, setOpponent] = useState<{ id: string; username: string } | null>(null);

  const boardRef = useRef(board);
  const turnRef = useRef(turn);
  boardRef.current = board;
  turnRef.current = turn;

  const fetchMatchState = useCallback(async () => {
    if (!matchId) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from('matches').select('*').eq('id', matchId).single();
    if (data && user) {
      if (data.board_state) setBoard(data.board_state);
      setTurn(data.current_turn === data.player1_id ? "w" : "b");
      setP1Time(data.player1_time_remaining);
      setP2Time(data.player2_time_remaining);
      setPlayerColor(data.player1_id === user.id ? "w" : "b");
      
      const oppId = data.player1_id === user.id ? data.player2_id : data.player1_id;
      setOpponent({ id: oppId, username: `Challenger ${oppId.slice(0, 5)}` });
    }
  }, [matchId]);

  useEffect(() => {
    if (mode === '1v1' && matchId) {
      fetchMatchState();

      const channel = supabase
        .channel(`chess:${matchId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, (payload) => {
          if (payload.new.board_state) setBoard(payload.new.board_state);
          setTurn(payload.new.current_turn === payload.new.player1_id ? "w" : "b");
          setP1Time(payload.new.player1_time_remaining);
          setP2Time(payload.new.player2_time_remaining);

          if (payload.new.status === 'finished') {
            const winColor = payload.new.winner_id === payload.new.player1_id ? "w" : "b";
            setStatus("checkmate");
            setWinner(winColor);
          }
        })
        .subscribe();

      const tickTimer = setInterval(async () => {
        await supabase.functions.invoke('game_tick', { body: { match_id: matchId } });
      }, 5000);

      return () => {
        supabase.removeChannel(channel);
        clearInterval(tickTimer);
      };
    }
  }, [mode, matchId, fetchMatchState]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);

    const LIGHT = "#e8d5b0";
    const DARK  = "#a0785a";
    const HLmove = "rgba(106,200,100,0.45)";
    const HLsel  = "rgba(255,220,50,0.50)";

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        // Invert board for black player
        const dr = playerColor === "w" ? r : 7 - r;
        const dc = playerColor === "w" ? c : 7 - c;

        ctx.fillStyle = (r + c) % 2 === 0 ? LIGHT : DARK;
        ctx.fillRect(c * SQ, r * SQ, SQ, SQ);

        if (selected && selected[0] === dr && selected[1] === dc) {
          ctx.fillStyle = HLsel;
          ctx.fillRect(c * SQ, r * SQ, SQ, SQ);
        }
        if (highlights.some(([hr, hc]) => hr === dr && hc === dc)) {
          ctx.fillStyle = HLmove;
          ctx.fillRect(c * SQ, r * SQ, SQ, SQ);
          ctx.fillStyle = "rgba(50,180,50,0.6)";
          ctx.beginPath();
          ctx.arc(c * SQ + SQ / 2, r * SQ + SQ / 2, 10, 0, Math.PI * 2);
          ctx.fill();
        }

        const p = boardRef.current[dr][dc];
        if (p) {
          ctx.font = `${SQ * 0.72}px serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "rgba(0,0,0,0.25)";
          ctx.fillText(GLYPHS[p.color][p.type], c * SQ + SQ / 2 + 2, r * SQ + SQ / 2 + 2);
          ctx.fillStyle = p.color === "w" ? "#fff" : "#111";
          ctx.fillText(GLYPHS[p.color][p.type], c * SQ + SQ / 2, r * SQ + SQ / 2);
        }

        // Coordinates
        ctx.fillStyle = (r + c) % 2 === 0 ? DARK : LIGHT;
        ctx.font = "bold 10px Consolas";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        if (c === 0) ctx.fillText(String(playerColor === "w" ? 8 - r : r + 1), c * SQ + 3, r * SQ + 3);
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        if (r === 7) ctx.fillText(String.fromCharCode(playerColor === "w" ? 97 + c : 104 - c), c * SQ + SQ - 3, r * SQ + SQ - 3);
      }
    }
  }, [selected, highlights, playerColor]);

  useEffect(() => {
    draw();
  }, [draw, board]);

  const reset = () => {
    if (mode === '1v1') return;
    setBoard(initialBoard());
    setSelected(null);
    setHighlights([]);
    setTurn("w");
    setStatus("playing");
    setWinner(null);
    setInCheck(false);
    setAiThinking(false);
  };

  const checkEndgame = useCallback((b: Board, color: Color) => {
    const moves = allMoves(b, color);
    const check = isInCheck(b, color);
    setInCheck(check);
    if (moves.length === 0) {
      if (check) { setStatus("checkmate"); setWinner(opp(color)); }
      else        { setStatus("stalemate"); }
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    if (mode === '1v1' || turn !== "b" || status !== "playing") return;
    setAiThinking(true);
    const t = setTimeout(() => {
      const move = aiMove(boardRef.current);
      if (move) {
        const nb = applyMove(boardRef.current, move[0], move[1]);
        setBoard(nb);
        if (!checkEndgame(nb, "w")) setTurn("w");
      }
      setAiThinking(false);
    }, 400);
    return () => clearTimeout(t);
  }, [turn, status, checkEndgame, mode]);

  const handleClick = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (status !== "playing" || aiThinking) return;
    if (mode === '1v1' && turn !== playerColor) return;
    if (mode === 'Solo' && turn !== "w") return;

    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    
    // Invert click detection for black player
    let c = Math.floor(((e.clientX - rect.left) * scaleX) / SQ);
    let r = Math.floor(((e.clientY - rect.top) * scaleY) / SQ);
    if (mode === '1v1' && playerColor === 'b') {
      r = 7 - r;
      c = 7 - c;
    }

    if (!inBounds(r, c)) return;

    const b = boardRef.current;

    if (selected) {
      const move = highlights.find(([hr, hc]) => hr === r && hc === c);
      if (move) {
        const nb = applyMove(b, selected, [r, c]);
        
        if (mode === '1v1') {
          const { data: { user } } = await supabase.auth.getUser();
          if (user && matchId) {
             const isFinished = checkEndgame(nb, opp(playerColor));
             await supabase.rpc('perform_game_move', {
               p_match_id: matchId,
               p_player_id: user.id,
               p_move_data: { 
                 new_board: nb, 
                 from: selected, 
                 to: [r, c],
                 status: isFinished ? 'finished' : 'active'
               }
             });
          }
        } else {
          setBoard(nb);
          setSelected(null);
          setHighlights([]);
          if (!checkEndgame(nb, "b")) setTurn("b");
        }
        return;
      }
    }

    const piece = b[r][c];
    if (piece && piece.color === (mode === '1v1' ? playerColor : "w")) {
      setSelected([r, c]);
      setHighlights(legalMoves(b, r, c, piece.color));
    } else {
      setSelected(null);
      setHighlights([]);
    }
  };

  // Pre-game state is now handled by GamesScreen.tsx global matchmaking
  // If we land here without matchId in 1v1 mode, we just show a message or redirect back
  if (mode === '1v1' && !matchId) {
    return (
      <div className="min-h-screen bg-[#0B1121] flex flex-col items-center justify-center p-4">
        <Navbar />
        <h2 className="text-xl font-bold text-white mb-4">No active match found</h2>
        <Link href="/games" className="px-6 py-2 rounded-lg bg-blue-600 text-white font-bold">
          Back to Games
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1121] text-white">
      <Navbar />
      <div className="flex flex-col items-center pt-28 pb-16 px-4 gap-6">
        {/* Title Bar */}
        <div className="flex items-center gap-4 w-full max-w-[580px]">
          <Link href="/games" className="text-gray-500 hover:text-white transition-colors text-sm font-bold">
            ← Games
          </Link>
          <h1 className="text-2xl font-black text-white">♟ Chess</h1>
          <span className={`ml-auto border text-[11px] font-black uppercase px-3 py-0.5 rounded-full ${
            mode === '1v1' ? "bg-blue-500/10 border-blue-500/30 text-blue-400" : "bg-green-500/10 border-green-500/30 text-green-400"
          }`}>
            {mode}
          </span>
        </div>

        {/* 1v1 Stats Bar */}
        {mode === '1v1' && (
          <div className="grid grid-cols-2 gap-4 w-full max-w-[580px] bg-[#0d1326] border border-white/5 p-4 rounded-xl">
            <div className={`flex flex-col gap-1 border-r border-white/5 ${turn === playerColor ? 'opacity-100' : 'opacity-40'}`}>
              <span className="text-[10px] font-black uppercase text-gray-500">You ({playerColor === 'w' ? 'White' : 'Black'})</span>
              <div className="flex items-center justify-between pr-4">
                <span className="text-2xl font-black text-white">{playerColor === 'w' ? '♔' : '♚'}</span>
                <span className={`text-xl font-mono font-bold ${ (playerColor === 'w' ? p1Time : p2Time) < 60 ? 'text-red-500 animate-pulse' : 'text-gray-400'}`}>
                   {Math.floor((playerColor === 'w' ? p1Time : p2Time) / 60)}:{((playerColor === 'w' ? p1Time : p2Time) % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>
            <div className={`flex flex-col gap-1 pl-2 ${turn !== playerColor ? 'opacity-100' : 'opacity-40'}`}>
              <span className="text-[10px] font-black uppercase text-gray-500">{opponent?.username || 'Opponent'}</span>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-blue-400">{playerColor === 'w' ? '♚' : '♔'}</span>
                <span className={`text-xl font-mono font-bold ${ (playerColor === 'w' ? p2Time : p1Time) < 60 ? 'text-red-500 animate-pulse' : 'text-gray-400'}`}>
                   {Math.floor((playerColor === 'w' ? p2Time : p1Time) / 60)}:{((playerColor === 'w' ? p2Time : p1Time) % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Status Bar */}
        <div className="flex items-center gap-4 w-full max-w-[580px]">
          <div className="flex flex-col">
            <span className="text-[11px] font-black uppercase text-gray-500 tracking-widest">
              {status === "playing" ? "Turn" : "Result"}
            </span>
            <span className={`text-lg font-black ${turn === "w" ? "text-white" : "text-blue-400"}`}>
              {status === "playing"
                ? turn === playerColor
                  ? "Your Turn"
                  : mode === 'Solo' && aiThinking
                  ? "AI Thinking…"
                  : "Opponent's Turn"
                : status === "checkmate"
                ? winner === playerColor
                  ? "🎉 You Win! Checkmate!"
                  : "😞 You Lose! Checkmate!"
                : "🤝 Stalemate — Draw"}
            </span>
            {inCheck && status === "playing" && (
              <span className="text-red-400 text-xs font-bold mt-0.5">⚠ In Check!</span>
            )}
          </div>
          {mode === 'Solo' && (
            <button
              onClick={reset}
              className="ml-auto px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all active:scale-95"
            >
              New Game
            </button>
          )}
        </div>

        {/* Board */}
        <div
          className={`rounded-xl overflow-hidden border shadow-2xl transition-all ${
            inCheck && status === "playing"
              ? "border-red-500/60 shadow-red-900/30"
              : "border-blue-500/20 shadow-blue-900/20"
          }`}
        >
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            onClick={handleClick}
            className="block cursor-pointer"
            style={{ width: `${W}px`, height: `${H}px`, maxWidth: "min(544px,95vw)", aspectRatio: "1" }}
          />
        </div>

        <p className="text-gray-500 text-xs font-bold text-center">
          {mode === '1v1' 
            ? "10 minutes per player · Timer runs while it's your turn" 
            : "Click a piece to select · Click a green dot to move · Auto-promotes Pawn → Queen"}
        </p>

        {/* Rules Section */}
        <div className="w-full max-w-[580px] bg-[#0d1326] border border-white/5 rounded-2xl p-8 mt-12 animate-fade-in">
          <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 text-[10px]">?</span>
            Game Rules
          </h3>
          
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="w-1 h-1 rounded-full bg-blue-500 mt-2.5 shrink-0" />
              <div>
                <h4 className="text-[11px] font-black text-blue-400 uppercase mb-1">Winning Conditions</h4>
                <p className="text-xs text-gray-400 leading-relaxed font-medium">Deliver checkmate to the opponent's king. If your opponent runs out of time, you win automatically.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-1 h-1 rounded-full bg-blue-500 mt-2.5 shrink-0" />
              <div>
                <h4 className="text-[11px] font-black text-blue-400 uppercase mb-1">Match Duration</h4>
                <p className="text-xs text-gray-400 leading-relaxed font-medium">Total time is 10 minutes per player. Your clock only runs during your turn.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-1 h-1 rounded-full bg-blue-500 mt-2.5 shrink-0" />
              <div>
                <h4 className="text-[11px] font-black text-blue-400 uppercase mb-1">Special Moves</h4>
                <p className="text-xs text-gray-400 leading-relaxed font-medium">Pawns automatically promote to Queens when reaching the final rank. Castling and En Passant are currently simplified.</p>
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t border-white/5">
              <div className="w-1 h-1 rounded-full bg-yellow-500 mt-2.5 shrink-0" />
              <div>
                <h4 className="text-[11px] font-black text-yellow-500 uppercase mb-1">Fair Play</h4>
                <p className="text-xs text-gray-400 leading-relaxed font-medium">Disconnecting for more than 2 minutes or closing the tab counts as a forfeit.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
