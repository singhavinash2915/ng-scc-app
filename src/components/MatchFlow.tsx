import { useMemo, useState } from 'react';
import { Coins, Trophy, ChevronRight } from 'lucide-react';
import { suggestMom } from '../lib/momSuggest';
import type { Ball, MatchFormat } from '../lib/cricketRules';
import type { Member } from '../types';

// ─── The match around the scoring pad ──────────────────────────────────────────
// Three moments the pad can't handle on its own: the toss at the start, the
// break between innings, and declaring a result at the end. Each is a full-screen
// step rather than a control tucked into the pad, because each happens once and
// deserves the scorer's whole attention.

export type Side = { key: string; name: string };

// ── 1. Toss ────────────────────────────────────────────────────────────────────
export function TossSheet({ sides, onStart }: {
  sides: [Side, Side];
  onStart: (battingFirst: string, bowlingFirst: string) => void;
}) {
  const [winner, setWinner] = useState<string | null>(null);
  const [decision, setDecision] = useState<'bat' | 'bowl' | null>(null);

  const other = (k: string) => (k === sides[0].key ? sides[1].key : sides[0].key);
  const nameOf = (k: string) => sides.find(s => s.key === k)?.name ?? k;

  return (
    <div className="r-card border-2 border-slate-200 dark:border-white/10 p-5 space-y-4">
      <div>
        <p className="inline-flex items-center gap-1.5 t-micro font-black uppercase tracking-widest text-amber-600">
          <Coins className="w-3.5 h-3.5" /> Toss
        </p>
        <p className="font-black text-lg text-slate-900 dark:text-white mt-0.5">
          Who won it?
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {sides.map(s => (
          <button key={s.key} onClick={() => setWinner(s.key)}
            className={`r-control py-3.5 font-black text-sm border-2 ${
              winner === s.key
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700'
                : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70'}`}>
            {s.name}
          </button>
        ))}
      </div>

      {winner && (
        <>
          <p className="font-black text-lg text-slate-900 dark:text-white">
            {nameOf(winner)} chose to…
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(['bat', 'bowl'] as const).map(d => (
              <button key={d} onClick={() => setDecision(d)}
                className={`r-control py-3.5 font-black text-sm border-2 ${
                  decision === d
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700'
                    : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70'}`}>
                {d === 'bat' ? '🏏 Bat first' : '🏐 Bowl first'}
              </button>
            ))}
          </div>
        </>
      )}

      {winner && decision && (
        <button
          onClick={() => {
            const battingFirst = decision === 'bat' ? winner : other(winner);
            onStart(battingFirst, other(battingFirst));
          }}
          className="w-full r-control bg-emerald-500 text-white font-black py-4 text-sm
                     inline-flex items-center justify-center gap-2">
          Start — {nameOf(decision === 'bat' ? winner : other(winner))} batting
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ── 2. Innings break ───────────────────────────────────────────────────────────
export function InningsBreak({ battingTeam, chasingTeam, runs, wickets, overs, onStart }: {
  battingTeam: string; chasingTeam: string;
  runs: number; wickets: number; overs: string;
  onStart: () => void;
}) {
  return (
    <div className="r-card overflow-hidden text-white shadow-2xl"
      style={{ background: 'linear-gradient(150deg,#1e1b4b,#020617)' }}>
      <div className="p-6 text-center">
        <p className="t-micro font-black uppercase tracking-[2px] text-white/60">Innings break</p>
        <p className="font-display text-2xl font-extrabold mt-2">{battingTeam}</p>
        <p className="font-display text-5xl font-extrabold tabular-nums mt-1">
          {runs}<span className="text-white/40">/</span>{wickets}
        </p>
        <p className="text-white/55 text-sm mt-1">in {overs} overs</p>

        <div className="mt-5 r-card bg-white/10 border border-white/15 px-4 py-3">
          <p className="t-meta text-white/60">{chasingTeam} need</p>
          <p className="font-display text-3xl font-extrabold">{runs + 1}</p>
          <p className="t-meta text-white/60">to win</p>
        </div>

        <button onClick={onStart}
          className="mt-5 w-full r-control bg-white text-slate-900 font-black py-3.5 text-sm">
          Start {chasingTeam}'s innings
        </button>
      </div>
    </div>
  );
}

// ── 3. Result + Man of the Match ───────────────────────────────────────────────
export function MatchResult({ first, second, allBalls, secondBalls, members, format, onFinish, saving }: {
  first: { team: string; runs: number; wickets: number; overs: string };
  second: { team: string; runs: number; wickets: number; overs: string };
  allBalls: Ball[];
  /** Second-innings balls only — used to work out who was on the winning side. */
  secondBalls: Ball[];
  members: Member[];
  format: MatchFormat;
  onFinish: (winner: string | null, momId: string | null) => void;
  saving: boolean;
}) {
  const [mom, setMom] = useState<string | null>(null);

  const chased = second.runs >= first.runs + 1;
  const winner = chased ? second.team : first.runs > second.runs ? first.team : null;
  const margin = chased
    ? `${format.playersPerSide - 1 - second.wickets} wickets`
    : winner ? `${first.runs - second.runs} runs` : '';

  /**
   * Suggested Man of the Match. Judged against THIS match's run rate rather than
   * fixed thresholds, and weighted towards the winning side — a hard 30 on a low
   * pitch and a chase-sealing spell are exactly what a flat runs+wickets tally
   * misses. Still only a suggestion: the scorer picks, because a match-winning
   * catch or a rearguard stand never fully shows up in a formula.
   */
  const suggestions = useMemo(() => {
    // The chasing side bats in the second innings; if they lost, the winners are
    // the side that bowled it.
    const winningSide = winner
      ? [...new Set(secondBalls.flatMap(b => (chased
          ? [b.striker_id, b.non_striker_id]
          : [b.bowler_id, b.fielder_id])).filter(Boolean) as string[])]
      : [];
    return suggestMom({ balls: allBalls, winningSide })
      .map(s => ({ ...s, member: members.find(m => m.id === s.memberId) }))
      .filter(s => s.member)
      .slice(0, 5);
  }, [allBalls, secondBalls, members, winner, chased]);

  return (
    <div className="space-y-3">
      <div className="r-card overflow-hidden text-white shadow-2xl"
        style={{ background: 'linear-gradient(150deg,#064e3b,#020617)' }}>
        <div className="p-6 text-center">
          <p className="text-5xl">🏆</p>
          <p className="font-display text-2xl font-extrabold mt-2">
            {winner ? `${winner} won by ${margin}` : 'Match tied'}
          </p>
          <div className="grid grid-cols-2 gap-2 mt-5 text-left">
            {[first, second].map(i => (
              <div key={i.team} className="r-card bg-white/10 border border-white/15 px-3 py-2.5">
                <p className="t-meta text-white/60 truncate">{i.team}</p>
                <p className="font-display text-xl font-extrabold tabular-nums">
                  {i.runs}/{i.wickets}
                </p>
                <p className="t-micro text-white/45">{i.overs} ov</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="r-card border-2 border-slate-200 dark:border-white/10 p-5">
        <p className="inline-flex items-center gap-1.5 t-micro font-black uppercase tracking-widest text-amber-600">
          <Trophy className="w-3.5 h-3.5" /> Man of the Match
        </p>
        <p className="t-meta text-slate-500 mt-1 mb-3">
          Ranked on impact in this match — runs, wickets, catches, and how they went
          against the match run rate. It's still your call.
        </p>
        <div className="space-y-1.5">
          {suggestions.map(s => (
            <button key={s.member!.id} onClick={() => setMom(s.member!.id)}
              className={`w-full flex items-center justify-between r-control border-2 px-3.5 py-3 ${
                mom === s.member!.id
                  ? 'border-amber-400 bg-amber-50 dark:bg-amber-500/10'
                  : 'border-slate-200 dark:border-white/10'}`}>
              <span className="font-bold t-body text-slate-800 dark:text-white/85">
                {s.member!.name}
              </span>
              <span className="t-meta text-slate-400 tabular-nums">
                {s.line}
              </span>
            </button>
          ))}
        </div>

        <button onClick={() => onFinish(winner, mom)} disabled={saving}
          className="mt-4 w-full r-control bg-emerald-500 text-white font-black py-4 text-sm disabled:opacity-40">
          {saving ? 'Saving…' : 'Publish result'}
        </button>
        <p className="t-micro text-slate-400 mt-2 text-center">
          Writes the result to the match and marks it app-scored, so the CricHeroes
          sync won't overwrite it.
        </p>
      </div>
    </div>
  );
}
