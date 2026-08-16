import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Undo2, Radio, WifiOff, Lock, Users } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { useMembers } from '../hooks/useMembers';
import { useMatches } from '../hooks/useMatches';
import { useScoring } from '../hooks/useScoring';
import { DEFAULT_FORMAT, type WicketType, type ExtraType } from '../lib/cricketRules';

// ─── Live scoring ──────────────────────────────────────────────────────────────
// One page, two faces. Whoever holds the lock gets the scoring pad; everyone
// else gets the live view of the same match. Members were never going to want
// two separate URLs for "the score" depending on who they are.
//
// The pad is built around taps-per-ball: the six run buttons are thumb-sized and
// always in the same place, extras are one row down, and undo is never more than
// one tap away because mis-taps are constant when you're watching the cricket
// rather than the phone.

const RUNS = [0, 1, 2, 3, 4, 6];
const EXTRAS: Array<{ key: ExtraType; label: string; hint: string }> = [
  { key: 'wd', label: 'Wide',   hint: '+1, re-bowled' },
  { key: 'nb', label: 'No ball', hint: '+1, free hit' },
  { key: 'b',  label: 'Bye',    hint: 'not the bowler' },
  { key: 'lb', label: 'Leg bye', hint: 'not the bowler' },
];
const WICKETS: Array<{ key: WicketType; label: string }> = [
  { key: 'bowled', label: 'Bowled' },
  { key: 'caught', label: 'Caught' },
  { key: 'lbw', label: 'LBW' },
  { key: 'run_out', label: 'Run out' },
  { key: 'stumped', label: 'Stumped' },
  { key: 'hit_wicket', label: 'Hit wicket' },
];

export function LiveScoring() {
  const { matchId } = useParams<{ matchId: string }>();
  const { members } = useMembers();
  const { matches } = useMatches();
  const myId = typeof window !== 'undefined'
    ? localStorage.getItem('scc-my-profile-id') : null;

  const match = matches.find(m => m.id === matchId);
  const format = useMemo(() => ({
    oversPerInnings: (match as { overs_per_innings?: number } | undefined)?.overs_per_innings
      ?? DEFAULT_FORMAT.oversPerInnings,
    playersPerSide: (match as { players_per_side?: number } | undefined)?.players_per_side
      ?? DEFAULT_FORMAT.playersPerSide,
    maxOversPerBowler: (match as { max_overs_per_bowler?: number } | undefined)?.max_overs_per_bowler
      ?? DEFAULT_FORMAT.maxOversPerBowler,
  }), [match]);

  const [innings, setInnings] = useState<1 | 2>(1);
  const S = useScoring(matchId ?? null, innings, format);

  const iAmScoring = !!myId && S.lockHolder === myId && S.lockFresh;
  const someoneElse = S.lockFresh && S.lockHolder && S.lockHolder !== myId;

  // Hold the lock open while this page is in front of the scorer.
  useEffect(() => {
    if (!iAmScoring || !myId) return;
    const id = window.setInterval(() => S.heartbeat(myId), S.HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [iAmScoring, myId, S]);

  // Who's in — seeded by the scorer, then the rules engine keeps track.
  const [striker, setStriker] = useState<string | null>(null);
  const [nonStriker, setNonStriker] = useState<string | null>(null);
  const [bowler, setBowler] = useState<string | null>(null);
  const [wicketSheet, setWicketSheet] = useState<ExtraType | 'W' | null>(null);

  useEffect(() => {
    if (S.state.strikerId) setStriker(S.state.strikerId);
    if (S.state.nonStrikerId) setNonStriker(S.state.nonStrikerId);
  }, [S.state.strikerId, S.state.nonStrikerId]);

  const name = (id: string | null) =>
    members.find(m => m.id === id)?.name ?? '—';
  const squad = useMemo(
    () => members.filter(m => m.status === 'active').sort((a, b) => a.name.localeCompare(b.name)),
    [members],
  );

  const record = (input: Parameters<typeof S.scoreBall>[0]) => {
    void S.scoreBall(input, { strikerId: striker, nonStrikerId: nonStriker, bowlerId: bowler }, myId);
    setWicketSheet(null);
  };

  if (S.tableMissing) {
    return (
      <div>
        <Header title="Live Scoring" subtitle="Not set up yet" />
        <div className="p-8 max-w-lg mx-auto mt-10 rounded-3xl bg-amber-50 border border-amber-200 p-6">
          <p className="font-black text-amber-900">Scoring tables not created yet</p>
          <p className="text-sm text-amber-800/80 mt-1.5">
            Run <code className="font-mono">supabase/migrations/add_scoring_module.sql</code> in the
            Supabase SQL editor, then reload.
          </p>
        </div>
      </div>
    );
  }

  const st = S.state;

  return (
    <div className="min-h-screen">
      <Header title="Live Scoring"
        subtitle={match ? `${match.opponent ?? 'Match'} · ${format.oversPerInnings} overs` : 'Match'} />

      <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-4">

        {/* ── SCOREBOARD — the thing everyone looks at ─────────────────── */}
        <div className="relative overflow-hidden rounded-3xl text-white shadow-2xl"
          style={{ background: 'linear-gradient(150deg,#052e16,#020617)' }}>
          <div className="p-6 text-center">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[2px] text-emerald-300">
              <Radio className="w-3 h-3" /> Innings {innings}
              {S.pending > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-amber-300">
                  <WifiOff className="w-3 h-3" /> {S.pending} queued
                </span>
              )}
            </span>
            <p className="font-display text-6xl font-extrabold tabular-nums mt-2 leading-none">
              {st.runs}<span className="text-white/40">/</span>{st.wickets}
            </p>
            <p className="text-white/60 text-sm mt-1.5">
              {st.overs} / {format.oversPerInnings} overs · RR {st.runRate.toFixed(2)}
            </p>

            {/* batters + bowler */}
            <div className="grid grid-cols-3 gap-2 mt-5 text-left">
              {[
                { l: 'Striker', v: name(striker) },
                { l: 'Non-striker', v: name(nonStriker) },
                { l: 'Bowler', v: name(bowler) },
              ].map(x => (
                <div key={x.l} className="rounded-2xl bg-white/10 border border-white/15 px-3 py-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/45">{x.l}</p>
                  <p className="text-[13px] font-bold truncate">{x.v}</p>
                </div>
              ))}
            </div>

            {/* this over */}
            <div className="flex items-center justify-center gap-1.5 mt-4 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40 mr-1">
                This over
              </span>
              {st.thisOver.length === 0 && <span className="text-white/30 text-xs">—</span>}
              {st.thisOver.map(b => {
                const wkt = b.wicket_type && b.wicket_type !== 'retired';
                const label = wkt ? 'W'
                  : b.extra_type === 'wd' ? 'wd'
                  : b.extra_type === 'nb' ? 'nb'
                  : b.extra_type ? `${b.extra_runs}${b.extra_type}`
                  : String(b.runs_off_bat);
                return (
                  <span key={b.seq}
                    className={`w-8 h-8 rounded-lg text-[11px] font-black flex items-center justify-center ${
                      wkt ? 'bg-rose-500' : b.runs_off_bat >= 4 ? 'bg-emerald-500'
                      : b.extra_type ? 'bg-amber-500/80' : 'bg-white/15'}`}>
                    {label}
                  </span>
                );
              })}
            </div>

            {S.freeHit && (
              <p className="mt-3 inline-block rounded-full bg-amber-400 text-slate-900 px-3 py-1 text-[10px] font-black">
                FREE HIT — only run out
              </p>
            )}
            {st.isComplete && (
              <p className="mt-3 inline-block rounded-full bg-white/15 px-4 py-1.5 text-[11px] font-black">
                Innings complete · {st.completeReason}
              </p>
            )}
          </div>
        </div>

        {/* innings switch — viewers want the first innings back after the break */}
        <div className="grid grid-cols-2 gap-2">
          {([1, 2] as const).map(i => (
            <button key={i} onClick={() => setInnings(i)}
              className={`rounded-2xl py-2.5 text-[12px] font-black border-2 ${
                innings === i ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700'
                : 'border-slate-200 dark:border-white/10 text-slate-500'}`}>
              Innings {i}
            </button>
          ))}
        </div>

        {/* ── WHO IS SCORING ───────────────────────────────────────────── */}
        {!iAmScoring && (
          <div className="rounded-2xl border-2 border-slate-200 dark:border-white/10 p-4">
            {!myId ? (
              <p className="text-sm text-slate-500 inline-flex items-center gap-2">
                <Users className="w-4 h-4" />
                Pick your profile on the Members page to score.
              </p>
            ) : someoneElse ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-slate-600 dark:text-white/70 inline-flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-500" />
                  <b>{name(S.lockHolder)}</b> is scoring.
                </p>
                {/* A dead phone shouldn't lock the match out — the heartbeat
                    goes stale and anyone can take it on. */}
                <button onClick={() => myId && S.claimLock(myId)}
                  className="text-[11px] font-black text-slate-400">Take over</button>
              </div>
            ) : (
              <button onClick={() => myId && S.claimLock(myId)}
                className="w-full rounded-xl bg-emerald-500 text-white font-black py-3 text-sm">
                Start scoring this match
              </button>
            )}
          </div>
        )}

        {/* ── THE PAD ──────────────────────────────────────────────────── */}
        {iAmScoring && (
          <div className="space-y-2.5">
            {/* who's in — only needed at the start of an innings or after a wicket */}
            {(!striker || !nonStriker || !bowler) && (
              <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 dark:bg-amber-500/10 p-4 space-y-2">
                <p className="text-[11px] font-black uppercase tracking-widest text-amber-700">
                  Set the players
                </p>
                {[
                  { l: 'Striker', v: striker, set: setStriker },
                  { l: 'Non-striker', v: nonStriker, set: setNonStriker },
                  { l: 'Bowler', v: bowler, set: setBowler },
                ].map(f => (
                  <select key={f.l} value={f.v ?? ''} onChange={e => f.set(e.target.value || null)}
                    className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm">
                    <option value="">{f.l}…</option>
                    {squad.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                ))}
              </div>
            )}

            {/* runs — the 80% case, one tap */}
            <div className="grid grid-cols-6 gap-2">
              {RUNS.map(r => (
                <button key={r} onClick={() => record({ runsOffBat: r })}
                  disabled={st.isComplete}
                  className={`h-16 rounded-2xl font-display text-2xl font-extrabold shadow-sm
                    disabled:opacity-30 active:scale-95 transition-transform ${
                    r === 4 || r === 6 ? 'bg-emerald-500 text-white'
                    : 'bg-white dark:bg-white/10 text-slate-900 dark:text-white border-2 border-slate-200 dark:border-white/10'}`}>
                  {r}
                </button>
              ))}
            </div>

            {/* extras + wicket */}
            <div className="grid grid-cols-5 gap-2">
              {EXTRAS.map(x => (
                <button key={x.key} onClick={() => setWicketSheet(x.key)}
                  disabled={st.isComplete}
                  className="h-14 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border-2 border-amber-200
                             dark:border-amber-400/20 text-amber-700 dark:text-amber-300 font-black text-[11px]
                             disabled:opacity-30 active:scale-95 transition-transform">
                  {x.label}
                </button>
              ))}
              <button onClick={() => setWicketSheet('W')} disabled={st.isComplete}
                className="h-14 rounded-2xl bg-rose-500 text-white font-black text-sm
                           disabled:opacity-30 active:scale-95 transition-transform">
                OUT
              </button>
            </div>

            <button onClick={() => S.undoBall()} disabled={S.balls.length === 0}
              className="w-full rounded-2xl border-2 border-slate-200 dark:border-white/10 py-3
                         font-black text-[12px] text-slate-600 dark:text-white/70 disabled:opacity-30
                         inline-flex items-center justify-center gap-2">
              <Undo2 className="w-4 h-4" /> Undo last ball
            </button>

            <button onClick={() => S.releaseLock()}
              className="w-full text-[11px] font-bold text-slate-400 py-1">
              Hand over scoring
            </button>
          </div>
        )}

        {/* ── EXTRA / WICKET SHEET ─────────────────────────────────────── */}
        {wicketSheet && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setWicketSheet(null)} />
            <div className="relative w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-5 space-y-3">
              <p className="font-black text-lg text-slate-900 dark:text-white">
                {wicketSheet === 'W' ? 'How was he out?'
                  : EXTRAS.find(e => e.key === wicketSheet)?.label}
              </p>

              {wicketSheet === 'W' ? (
                <div className="grid grid-cols-2 gap-2">
                  {WICKETS.map(w => (
                    <button key={w.key}
                      onClick={() => record({
                        wicketType: w.key,
                        // A run out can take the non-striker; everything else is
                        // the man on strike.
                        dismissedId: w.key === 'run_out' ? striker : striker,
                      })}
                      className="rounded-2xl border-2 border-slate-200 dark:border-white/10 py-3
                                 font-black text-[12px] text-slate-700 dark:text-white/80">
                      {w.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-2">
                  {[0, 1, 2, 3, 4].map(extra => (
                    <button key={extra}
                      onClick={() => record({
                        extraType: wicketSheet as ExtraType,
                        // A wide or no-ball is one run plus anything run.
                        extraRuns: (wicketSheet === 'wd' || wicketSheet === 'nb') ? extra + 1 : extra,
                        runsOffBat: 0,
                      })}
                      className="h-14 rounded-2xl border-2 border-slate-200 dark:border-white/10
                                 font-display text-xl font-extrabold text-slate-900 dark:text-white">
                      {(wicketSheet === 'wd' || wicketSheet === 'nb') ? `+${extra + 1}` : extra}
                    </button>
                  ))}
                </div>
              )}

              <button onClick={() => setWicketSheet(null)}
                className="w-full text-[11px] font-bold text-slate-400 pt-1">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LiveScoring;
