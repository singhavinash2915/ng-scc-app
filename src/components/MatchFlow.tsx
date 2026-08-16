import { useMemo, useState } from 'react';
import { Coins, Trophy, ChevronRight } from 'lucide-react';
import { battingCard, bowlingCard, type Ball, type MatchFormat } from '../lib/cricketRules';
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
    <div className="rounded-3xl border-2 border-slate-200 dark:border-white/10 p-5 space-y-4">
      <div>
        <p className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-600">
          <Coins className="w-3.5 h-3.5" /> Toss
        </p>
        <p className="font-black text-lg text-slate-900 dark:text-white mt-0.5">
          Who won it?
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {sides.map(s => (
          <button key={s.key} onClick={() => setWinner(s.key)}
            className={`rounded-2xl py-3.5 font-black text-sm border-2 ${
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
                className={`rounded-2xl py-3.5 font-black text-sm border-2 ${
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
          className="w-full rounded-2xl bg-emerald-500 text-white font-black py-4 text-sm
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
    <div className="rounded-3xl overflow-hidden text-white shadow-2xl"
      style={{ background: 'linear-gradient(150deg,#1e1b4b,#020617)' }}>
      <div className="p-6 text-center">
        <p className="text-[10px] font-black uppercase tracking-[2px] text-white/60">Innings break</p>
        <p className="font-display text-2xl font-extrabold mt-2">{battingTeam}</p>
        <p className="font-display text-5xl font-extrabold tabular-nums mt-1">
          {runs}<span className="text-white/40">/</span>{wickets}
        </p>
        <p className="text-white/55 text-sm mt-1">in {overs} overs</p>

        <div className="mt-5 rounded-2xl bg-white/10 border border-white/15 px-4 py-3">
          <p className="text-[11px] text-white/60">{chasingTeam} need</p>
          <p className="font-display text-3xl font-extrabold">{runs + 1}</p>
          <p className="text-[11px] text-white/60">to win</p>
        </div>

        <button onClick={onStart}
          className="mt-5 w-full rounded-2xl bg-white text-slate-900 font-black py-3.5 text-sm">
          Start {chasingTeam}'s innings
        </button>
      </div>
    </div>
  );
}

// ── 3. Result + Man of the Match ───────────────────────────────────────────────
export function MatchResult({ first, second, allBalls, members, format, onFinish, saving }: {
  first: { team: string; runs: number; wickets: number; overs: string };
  second: { team: string; runs: number; wickets: number; overs: string };
  allBalls: Ball[];
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
   * Suggested Man of the Match — runs plus twenty a wicket, the same weighting
   * the MVP race uses. Only a suggestion: the scorer picks, because a match-
   * winning catch or a rearguard thirty never shows up in a formula.
   */
  const suggestions = useMemo(() => {
    const bat = battingCard(allBalls), bowl = bowlingCard(allBalls);
    const impact = new Map<string, { runs: number; wkts: number; score: number }>();
    for (const [id, l] of bat) impact.set(id, { runs: l.runs, wkts: 0, score: l.runs });
    for (const [id, l] of bowl) {
      const cur = impact.get(id) ?? { runs: 0, wkts: 0, score: 0 };
      cur.wkts = l.wickets; cur.score += l.wickets * 20;
      impact.set(id, cur);
    }
    return [...impact.entries()]
      .map(([id, v]) => ({ member: members.find(m => m.id === id), ...v }))
      .filter(x => x.member && x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [allBalls, members]);

  return (
    <div className="space-y-3">
      <div className="rounded-3xl overflow-hidden text-white shadow-2xl"
        style={{ background: 'linear-gradient(150deg,#064e3b,#020617)' }}>
        <div className="p-6 text-center">
          <p className="text-5xl">🏆</p>
          <p className="font-display text-2xl font-extrabold mt-2">
            {winner ? `${winner} won by ${margin}` : 'Match tied'}
          </p>
          <div className="grid grid-cols-2 gap-2 mt-5 text-left">
            {[first, second].map(i => (
              <div key={i.team} className="rounded-2xl bg-white/10 border border-white/15 px-3 py-2.5">
                <p className="text-[11px] text-white/60 truncate">{i.team}</p>
                <p className="font-display text-xl font-extrabold tabular-nums">
                  {i.runs}/{i.wickets}
                </p>
                <p className="text-[10px] text-white/45">{i.overs} ov</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border-2 border-slate-200 dark:border-white/10 p-5">
        <p className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-600">
          <Trophy className="w-3.5 h-3.5" /> Man of the Match
        </p>
        <p className="text-[11px] text-slate-500 mt-1 mb-3">
          Top performers by runs and wickets — but a match-winning catch never shows
          in a formula, so it's your call.
        </p>
        <div className="space-y-1.5">
          {suggestions.map(s => (
            <button key={s.member!.id} onClick={() => setMom(s.member!.id)}
              className={`w-full flex items-center justify-between rounded-xl border-2 px-3.5 py-3 ${
                mom === s.member!.id
                  ? 'border-amber-400 bg-amber-50 dark:bg-amber-500/10'
                  : 'border-slate-200 dark:border-white/10'}`}>
              <span className="font-bold text-[13px] text-slate-800 dark:text-white/85">
                {s.member!.name}
              </span>
              <span className="text-[11px] text-slate-400 tabular-nums">
                {s.runs} runs{s.wkts ? ` · ${s.wkts} wkt${s.wkts > 1 ? 's' : ''}` : ''}
              </span>
            </button>
          ))}
        </div>

        <button onClick={() => onFinish(winner, mom)} disabled={saving}
          className="mt-4 w-full rounded-2xl bg-emerald-500 text-white font-black py-4 text-sm disabled:opacity-40">
          {saving ? 'Saving…' : 'Publish result'}
        </button>
        <p className="text-[10px] text-slate-400 mt-2 text-center">
          Writes the result to the match and marks it app-scored, so the CricHeroes
          sync won't overwrite it.
        </p>
      </div>
    </div>
  );
}
