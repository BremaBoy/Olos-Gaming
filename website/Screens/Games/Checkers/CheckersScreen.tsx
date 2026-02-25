"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Matchmaking from "@/components/Matchmaking";

// ── Constants ────────────────────────────────────────────────────────────────
const SQ = 72;
const W  = SQ * 8;
const H  = SQ * 8;

type Color = "red" | "black";
type PieceType = "man" | "king";
type Piece = { color: Color; type: PieceType };
type Board = (Piece | null)[][];
type Sq = [number, number];

function oppColor(c: Color): Color { return c === "red" ? "black" : "red"; }

// ── Board setup ──────────────────────────────────────────────────────────────
function initialBoard(): Board {
  const b: Board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 8; c++)
      if ((r + c) % 2 === 1) b[r][c] = { color: "black", type: "man" };
  for (let r = 5; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if ((r + c) % 2 === 1) b[r][c] = { color: "red", type: "man" };
  return b;
}

function copyBoard(b: Board): Board { return b.map(row => row.map(p => p ? { ...p } : null)); }
function inBounds(r: number, c: number) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

// ── Move generation ──────────────────────────────────────────────────────────
function jumpDirs(): [number,number][] { return [[-1,-1],[-1,1],[1,-1],[1,1]]; }
function moveDirs(piece: Piece): [number,number][] {
  if (piece.type === "king") return [[-1,-1],[-1,1],[1,-1],[1,1]];
  return piece.color === "red" ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]];
}

type Move = { from: Sq; to: Sq; captured: Sq[]; promotes: boolean };

function exploreCaptures(b: Board, r: number, c: number, piece: Piece, capSoFar: Sq[]): Move[] {
  const results: Move[] = [];
  let foundAny = false;
  for (const [dr,dc] of jumpDirs()) {
    const jr = r+dr, jc = c+dc, lr = r+2*dr, lc = c+2*dc;
    if (!inBounds(jr,jc) || !inBounds(lr,lc)) continue;
    if (capSoFar.some(([a,b]) => a===jr && b===jc)) continue;
    const jumped = b[jr][jc];
    if (!jumped || jumped.color === piece.color || b[lr][lc]) continue;
    foundAny = true;
    const newCap = [...capSoFar, [jr,jc] as Sq];
    const sub = exploreCaptures(b, lr, lc, piece, newCap);
    if (sub.length) { results.push(...sub); }
    else {
      const promotes = (piece.type === "man") && (piece.color === "red" ? lr===0 : lr===7);
      results.push({ from: [r,c], to: [lr,lc], captured: newCap, promotes });
    }
  }
  if (!foundAny && capSoFar.length) {
    const promotes = (piece.type === "man") && (piece.color === "red" ? r===0 : r===7);
    results.push({ from: [r,c], to: [r,c], captured: capSoFar, promotes });
  }
  return results;
}

function normalMoves(b: Board, r: number, c: number, piece: Piece): Move[] {
  return moveDirs(piece)
    .map(([dr,dc]) => [r+dr, c+dc] as Sq)
    .filter(([nr,nc]) => inBounds(nr,nc) && !b[nr][nc])
    .map(([nr,nc]) => {
      const promotes = (piece.type==="man") && (piece.color==="red" ? nr===0 : nr===7);
      return { from:[r,c] as Sq, to:[nr,nc] as Sq, captured:[] as Sq[], promotes };
    });
}

function movesForPiece(b: Board, r: number, c: number): Move[] {
  const piece = b[r][c];
  if (!piece) return [];
  const caps = exploreCaptures(b, r, c, piece, []);
  return caps.length ? caps : normalMoves(b, r, c, piece);
}

function allMovesFor(b: Board, color: Color): Move[] {
  const caps: Move[] = [], norms: Move[] = [];
  for (let r=0;r<8;r++) for (let c=0;c<8;c++)
    if (b[r][c]?.color===color) {
      caps.push(...exploreCaptures(b,r,c,b[r][c]!,[]));
      norms.push(...normalMoves(b,r,c,b[r][c]!));
    }
  return caps.length ? caps : norms;
}

function applyMove(b: Board, move: Move): Board {
  const nb = copyBoard(b);
  const p = { ...nb[move.from[0]][move.from[1]]! };
  nb[move.from[0]][move.from[1]] = null;
  for (const [jr,jc] of move.captured) nb[jr][jc] = null;
  if (move.promotes) p.type = "king";
  nb[move.to[0]][move.to[1]] = p;
  return nb;
}

function aiMove(b: Board): Move | null {
  const moves = allMovesFor(b, "black");
  if (!moves.length) return null;
  const captures = moves.filter(m => m.captured.length);
  if (captures.length) return captures[Math.floor(Math.random()*captures.length)];
  return moves[Math.floor(Math.random()*moves.length)];
}

function drawCanvas(canvas: HTMLCanvasElement, board: Board, selected: Sq | null, highlights: Move[], playerColor: Color) {
  const ctx = canvas.getContext("2d")!;
  const LIGHT = "#f0d9b5";
  const DARK  = "#b58863";

  for (let r=0;r<8;r++) {
    for (let c=0;c<8;c++) {
      const dr = playerColor === "red" ? r : 7 - r;
      const dc = playerColor === "red" ? c : 7 - c;

      ctx.fillStyle = (r+c)%2===0 ? LIGHT : DARK;
      ctx.fillRect(c*SQ, r*SQ, SQ, SQ);
      if (selected?.[0]===dr && selected?.[1]===dc) {
        ctx.fillStyle = "rgba(255,220,50,0.45)";
        ctx.fillRect(c*SQ, r*SQ, SQ, SQ);
      }
      const hl = highlights.find(m => m.to[0]===dr && m.to[1]===dc);
      if (hl) {
        ctx.fillStyle = "rgba(80,200,80,0.40)";
        ctx.fillRect(c*SQ, r*SQ, SQ, SQ);
        ctx.fillStyle = "rgba(50,180,50,0.7)";
        ctx.beginPath();
        ctx.arc(c*SQ+SQ/2, r*SQ+SQ/2, 10, 0, Math.PI*2);
        ctx.fill();
      }
      const piece = board[dr][dc];
      if (!piece) continue;
      const x = c*SQ+SQ/2, y = r*SQ+SQ/2, rad = SQ/2-8;
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath(); ctx.arc(x+3,y+3,rad,0,Math.PI*2); ctx.fill();
      const g = ctx.createRadialGradient(x-rad/3,y-rad/3,2,x,y,rad);
      if (piece.color==="red") {
        g.addColorStop(0,"#f87171"); g.addColorStop(1,"#b91c1c");
      } else {
        g.addColorStop(0,"#44475a"); g.addColorStop(1,"#1a1b23");
      }
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x,y,rad,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle = piece.color==="red" ? "#fca5a5" : "#6272a4";
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x,y,rad,0,Math.PI*2); ctx.stroke();
      if (piece.type==="king") {
        ctx.font = `${SQ*0.4}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#fde68a";
        ctx.fillText("♛", x, y);
      }
    }
  }
}

export default function CheckersScreen() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") || "Solo";
  const matchIdParam = searchParams.get("matchId");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [board, setBoard] = useState<Board>(initialBoard);
  const boardRef = useRef(board);
  boardRef.current = board;
  const [selected, setSelected] = useState<Sq | null>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const [highlights, setHighlights] = useState<Move[]>([]);
  const highlightsRef = useRef(highlights);
  highlightsRef.current = highlights;
  const [turn, setTurn] = useState<Color>("red");
  const turnRef = useRef(turn);
  turnRef.current = turn;
  const [status, setStatus] = useState<"playing"|"finished">("playing");
  const [winner, setWinner] = useState<Color|null>(null);
  const [moveCount, setMoveCount] = useState(0);
  const [aiThinking, setAiThinking] = useState(false);
  const [mustContinue, setMustContinue] = useState<Sq|null>(null); 
  const mustContinueRef = useRef(mustContinue);
  mustContinueRef.current = mustContinue;

  const [matchId, setMatchId] = useState<string | null>(matchIdParam);
  const [playerColor, setPlayerColor] = useState<Color>("red");
  const [p1Time, setP1Time] = useState(600);
  const [p2Time, setP2Time] = useState(600);
  const [opponent, setOpponent] = useState<{ id: string; username: string } | null>(null);

  const fetchMatchState = useCallback(async () => {
    if (!matchId) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from('matches').select('*').eq('id', matchId).single();
    if (data && user) {
      if (data.board_state) setBoard(data.board_state);
      setTurn(data.current_turn === data.player1_id ? "red" : "black");
      setP1Time(data.player1_time_remaining);
      setP2Time(data.player2_time_remaining);
      setPlayerColor(data.player1_id === user.id ? "red" : "black");
      
      const oppId = data.player1_id === user.id ? data.player2_id : data.player1_id;
      setOpponent({ id: oppId, username: `Challenger ${oppId.slice(0, 5)}` });
    }
  }, [matchId]);

  useEffect(() => {
    if (mode === '1v1' && matchId) {
      fetchMatchState();

      const channel = supabase
        .channel(`checkers:${matchId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, (payload) => {
          if (payload.new.board_state) setBoard(payload.new.board_state);
          setTurn(payload.new.current_turn === payload.new.player1_id ? "red" : "black");
          setP1Time(payload.new.player1_time_remaining);
          setP2Time(payload.new.player2_time_remaining);

          if (payload.new.status === 'finished') {
            const winColor = payload.new.winner_id === payload.new.player1_id ? "red" : "black";
            setStatus("finished");
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

  useEffect(() => {
    if (canvasRef.current) drawCanvas(canvasRef.current, board, selected, highlights, playerColor);
  }, [board, selected, highlights, playerColor]);

  const checkEnd = useCallback((b: Board, color: Color) => {
    const moves = allMovesFor(b, color);
    if (!moves.length) {
      setStatus("finished");
      setWinner(oppColor(color));
      return true;
    }
    return false;
  }, []);

  const reset = () => {
    if (mode === '1v1') return;
    setBoard(initialBoard());
    setSelected(null);
    setHighlights([]);
    setTurn("red");
    setStatus("playing");
    setWinner(null);
    setMoveCount(0);
    setAiThinking(false);
    setMustContinue(null);
  };

  useEffect(() => {
    if (mode === '1v1' || turn !== "black" || status !== "playing") return;
    setAiThinking(true);
    const t = setTimeout(() => {
      const move = aiMove(boardRef.current);
      if (move) {
        const nb = applyMove(boardRef.current, move);
        setBoard(nb);
        setMoveCount(m => m + 1);
        const followUp = move.captured.length ? exploreCaptures(nb, move.to[0], move.to[1], nb[move.to[0]][move.to[1]]!, []) : [];
        if (followUp.length) {
          setMustContinue(move.to);
          setTurn("black");
        } else {
          setMustContinue(null);
          if (!checkEnd(nb, "red")) setTurn("red");
        }
      }
      setAiThinking(false);
    }, 500);
    return () => clearTimeout(t);
  }, [turn, status, checkEnd, mode]);

  const handleClick = useCallback(async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (status !== "playing" || aiThinking) return;
    if (mode === '1v1' && turn !== playerColor) return;
    if (mode === 'Solo' && turn !== "red") return;

    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    
    // Invert click detection for black player
    let c = Math.floor(((e.clientX - rect.left) * scaleX) / SQ);
    let r = Math.floor(((e.clientY - rect.top) * scaleY) / SQ);
    if (mode === '1v1' && playerColor === 'black') {
      r = 7 - r;
      c = 7 - c;
    }

    if (!inBounds(r,c)) return;

    const b = boardRef.current;
    
    const finishMove = async (nb: Board, finalR: number, finalC: number, moveObj: Move) => {
      if (mode === '1v1') {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && matchId) {
          const followUp = moveObj.captured.length ? exploreCaptures(nb, finalR, finalC, nb[finalR][finalC]!, []) : [];
          const isFinished = !followUp.length && checkEnd(nb, oppColor(playerColor));
          
          await supabase.rpc('perform_game_move', {
            p_match_id: matchId,
            p_player_id: user.id,
            p_move_data: {
              new_board: nb,
              from: moveObj.from,
              to: moveObj.to,
              status: isFinished ? 'finished' : 'active'
            }
          });
          
          if (followUp.length) {
            setMustContinue([finalR, finalC]);
            setSelected([finalR, finalC]);
            setHighlights(followUp);
          } else {
            setMustContinue(null);
            setHighlights([]);
          }
        }
      } else {
        setBoard(nb);
        setMoveCount(m => m + 1);
        setSelected(null);
        const followUp = moveObj.captured.length ? exploreCaptures(nb, finalR, finalC, nb[finalR][finalC]!, []) : [];
        if (followUp.length) {
          setMustContinue([finalR, finalC]);
          setSelected([finalR, finalC]);
          setHighlights(followUp);
        } else {
          setMustContinue(null);
          setHighlights([]);
          if (!checkEnd(nb, "black")) setTurn("black");
        }
      }
    };

    const allPlayerMoves = allMovesFor(b, playerColor);
    const globalCaptures = allPlayerMoves.filter(m => m.captured.length > 0);

    const chain = mustContinueRef.current;
    if (chain) {
      const move = highlightsRef.current.find(m => m.to[0]===r && m.to[1]===c);
      if (move) {
        const nb = applyMove(b, move);
        await finishMove(nb, r, c, move);
      }
      return;
    }

    if (selectedRef.current) {
      const move = highlightsRef.current.find(m => m.to[0]===r && m.to[1]===c);
      if (move) {
        const nb = applyMove(b, move);
        await finishMove(nb, r, c, move);
        return;
      }
    }

    const piece = b[r][c];
    if (piece?.color === (mode === '1v1' ? playerColor : "red")) {
      let pieceMoves = movesForPiece(b, r, c);
      if (globalCaptures.length) pieceMoves = pieceMoves.filter(m => m.captured.length > 0);
      setSelected(pieceMoves.length ? [r,c] : null);
      setHighlights(pieceMoves);
    } else {
      setSelected(null);
      setHighlights([]);
    }
  }, [status, aiThinking, checkEnd, mode, playerColor, matchId]);

  if (mode === '1v1' && !matchId) {
    return (
      <div className="min-h-screen bg-[#0B1121] flex items-center justify-center p-4">
        <Matchmaking 
          game={{ slug: 'checkers', title: 'Checkers' }} 
          stake={10} 
          winnerReceives={18} 
          onCancel={() => window.location.href = '/games'}
          onComplete={(id) => setMatchId(id)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1121] text-white">
      <Navbar />
      <div className="flex flex-col items-center pt-28 pb-16 px-4 gap-6">
        {/* Title Bar */}
        <div className="flex items-center gap-4 w-full max-w-[600px]">
          <Link href="/games" className="text-gray-500 hover:text-white transition-colors text-sm font-bold">
            ← Games
          </Link>
          <h1 className="text-2xl font-black text-white">🔴 Checkers</h1>
          <span className={`ml-auto border text-[11px] font-black uppercase px-3 py-0.5 rounded-full ${
            mode === '1v1' ? "bg-blue-500/10 border-blue-500/30 text-blue-400" : "bg-red-500/10 border-red-500/30 text-red-400"
          }`}>
            {mode}
          </span>
        </div>

        {/* 1v1 Stats Bar */}
        {mode === '1v1' && (
          <div className="grid grid-cols-2 gap-4 w-full max-w-[600px] bg-[#0d1326] border border-white/5 p-4 rounded-xl">
            <div className={`flex flex-col gap-1 border-r border-white/5 ${turn === playerColor ? 'opacity-100' : 'opacity-40'}`}>
              <span className="text-[10px] font-black uppercase text-gray-500">You ({playerColor === 'red' ? 'Red' : 'Black'})</span>
              <div className="flex items-center justify-between pr-4">
                <div className={`w-4 h-4 rounded-full ${playerColor === 'red' ? 'bg-red-500' : 'bg-gray-700'}`}></div>
                <span className={`text-xl font-mono font-bold ${ (playerColor === 'red' ? p1Time : p2Time) < 60 ? 'text-red-500 animate-pulse' : 'text-gray-400'}`}>
                   {Math.floor((playerColor === 'red' ? p1Time : p2Time) / 60)}:{((playerColor === 'red' ? p1Time : p2Time) % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>
            <div className={`flex flex-col gap-1 pl-2 ${turn !== playerColor ? 'opacity-100' : 'opacity-40'}`}>
              <span className="text-[10px] font-black uppercase text-gray-500">{opponent?.username || 'Opponent'}</span>
              <div className="flex items-center justify-between">
                <div className={`w-4 h-4 rounded-full ${playerColor === 'red' ? 'bg-gray-700' : 'bg-red-500'}`}></div>
                <span className={`text-xl font-mono font-bold ${ (playerColor === 'red' ? p2Time : p1Time) < 60 ? 'text-red-500 animate-pulse' : 'text-gray-400'}`}>
                   {Math.floor((playerColor === 'red' ? p2Time : p1Time) / 60)}:{((playerColor === 'red' ? p2Time : p1Time) % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Status Bar */}
        <div className="flex items-center gap-4 w-full max-w-[600px]">
          <div className="flex flex-col">
            <span className="text-[11px] font-black uppercase text-gray-500 tracking-widest">
              {status === "finished" ? "Result" : "Status"}
            </span>
            <span className={`text-lg font-black ${
              status==="finished" ? (winner===playerColor ? "text-green-400" : "text-red-400") :
              turn===playerColor ? "text-red-400" : "text-blue-400"
            }`}>
              {status === "finished"
                ? winner === playerColor ? "🎉 You Win!" : "😞 You Lose!"
                : turn === playerColor
                ? mustContinue ? "⚡ Continue Capture!" : "Your Turn"
                : mode === 'Solo' && aiThinking ? "AI Thinking…" : "Opponent's Turn"}
            </span>
          </div>
          {mode === 'Solo' && (
            <>
              <div className="flex flex-col ml-4">
                <span className="text-[11px] font-black uppercase text-gray-500 tracking-widest">Moves</span>
                <span className="text-lg font-black text-white">{moveCount}</span>
              </div>
              <button
                onClick={reset}
                className="ml-auto px-5 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-bold transition-all active:scale-95"
              >
                New Game
              </button>
            </>
          )}
        </div>

        {/* Board */}
        <div className="rounded-xl overflow-hidden border border-red-500/20 shadow-2xl shadow-red-900/20">
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            onClick={handleClick}
            className="block cursor-pointer"
            style={{ width: `${W}px`, height: `${H}px`, maxWidth: "min(576px,95vw)", aspectRatio: "1" }}
          />
        </div>

        {status === "finished" && mode === 'Solo' && (
          <div className="flex gap-3">
            <button onClick={reset} className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-all active:scale-95">
              Play Again
            </button>
            <Link href="/games" className="px-6 py-2.5 rounded-xl border border-white/10 hover:border-white/30 text-white font-bold transition-all">
              Back to Games
            </Link>
          </div>
        )}

        <p className="text-gray-500 text-xs font-bold text-center">
          {mode === '1v1' 
            ? "10 minutes per player · Captures are mandatory · Kings can move backwards" 
            : "Click a red piece · Green dots = valid moves · Captures are mandatory · Kings can move backwards"}
        </p>
      </div>
    </div>
  );
}
