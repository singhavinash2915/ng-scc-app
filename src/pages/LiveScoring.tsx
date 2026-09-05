import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '../components/ui/Card';
import { useParams } from 'react-router-dom';
import { Undo2, Radio, WifiOff, Lock, Users, Wrench, ClipboardList, Repeat } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useMembers } from '../hooks/useMembers';
import { useMatches } from '../hooks/useMatches';
import { useScoring } from '../hooks/useScoring';
import { useMatchInnings } from '../hooks/useMatchInnings';
import { TossSheet, InningsBreak, MatchResult, type Side } from '../components/MatchFlow';
import { internalSides } from '../utils/internalTeams';
import { LiveViewer } from '../components/LiveViewer';
import { useLiveFeed } from '../hooks/useLiveFeed';
import { DEFAULT_FORMAT, battingCard, bowlingCard, type WicketType, type ExtraType } from '../lib/cricketRules';

// ─── Live scoring ──────────────────────────────────────────────────────────────
// One page, two faces. Whoever holds the lock gets the scoring pad; everyone
// else gets the live view of the same match. Members were never going to want
// two separate URLs for "the score" depending on who they are.
//
// The pad is built around taps-per-ball: the six run buttons are thumb-sized and
// always in the same place, extras are one row down, and undo is never more than
// one tap away because mis-taps are constant when you're watching the cricket
// rather than the phone.

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

// ─── Trial gate ────────────────────────────────────────────────────────────────
// Admin-only while the module is being trialled, so members don't stumble onto a
// half-tested scorer mid-season. The club's decision is that ANY member scores —
// flip this to false when the trial is done and the pad opens up as designed.
const ADMIN_ONLY_TRIAL = true;

export function LiveScoring() {
  const { matchId } = useParams<{ matchId: string }>();
  const { isAdmin } = useAuth();
  const { members } = useMembers();
  const { matches, fetchMatches } = useMatches();
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

  const M = useMatchInnings(matchId ?? null);
  /** The two sides, named from the fixture — "SCC Brahmos", not "Team 1". */
  const sides = useMemo<[Side, Side]>(() => {
    const s2 = internalSides(match ?? null);
    return match?.match_type === 'internal'
      ? [{ key: 'home', name: s2.home }, { key: 'away', name: s2.away }]
      : [{ key: 'home', name: 'Sangria CC' }, { key: 'away', name: match?.opponent || 'Opponent' }];
  }, [match]);
  const sideName = (k: string | undefined) => sides.find(x => x.key === k)?.name ?? k ?? '—';

  // Which innings is live follows the match record rather than a toggle — the
  // scorer shouldn't be able to put balls in the wrong innings by mistake.
  const innings: 1 | 2 = (M.current?.innings ?? 1) as 1 | 2;
  const [viewing, setViewing] = useState<1 | 2 | null>(null);
  const shown: 1 | 2 = viewing ?? innings;
  const S = useScoring(matchId ?? null, shown, format, M.rows.find(r => r.innings === shown)?.target);
  const [saving, setSaving] = useState(false);
  /**
   * The first innings, read-only. The result screen needs both totals and every
   * ball from the match to suggest a Man of the Match, and the pad itself only
   * ever holds the innings being viewed.
   */
  const I1 = useScoring(matchId ?? null, 1, format);
  const firstInnings = {
    balls: I1.balls,
    runs: I1.state.runs,
    wickets: I1.state.wickets,
    overs: I1.state.overs,
  };

  // The watching side of the page. Reads whichever source has data — our pad
  // when we're scoring, CricHeroes otherwise.
  const feed = useLiveFeed(
    matchId ?? null,
    (match as { ch_match_id?: string | null } | undefined)?.ch_match_id ?? null,
    format,
    { home: sides[0].name, away: sides[1].name },
  );

  const iAmScoring = !!myId && S.lockHolder === myId && S.lockFresh;
  const someoneElse = S.lockFresh && S.lockHolder && S.lockHolder !== myId;

  // Hold the lock open while this page is in front of the scorer.
  //
  // Depends on `heartbeat` and the interval constant, NOT on the whole `S`
  // object. S is a fresh object literal on every render, so listing it here
  // tore down and rebuilt this interval on every render — and the scoring page
  // re-renders far more often than every 20 seconds, so the timer never
  // survived long enough to fire once. The lock was written at claim time and
  // never refreshed again, which made the scorer's own lock read as stale after
  // 90 seconds: another admin could take the match off them mid-over, and two
  // people could end up entering balls into the same innings.
  //
  // It went unnoticed because the lock was also only ever read once, on mount,
  // so the staleness was invisible to the person actually scoring.
  //
  // Gated on HOLDING the lock, not on iAmScoring. iAmScoring also requires the
  // lock to be fresh, which made this self-defeating: any moment where freshness
  // briefly read false — a dropped poll, the switch between innings — stopped
  // the heartbeat, and with nothing writing it the lock then aged past stale for
  // real and never recovered. The scorer was locked out of their own match by
  // the very timer meant to keep them in it. Whether the lock is stale decides
  // if someone else may TAKE it; it should never decide whether its own holder
  // keeps it alive.
  const { heartbeat: sendHeartbeat, HEARTBEAT_MS, lockHolder } = S;
  const iHoldTheLock = !!myId && lockHolder === myId;
  useEffect(() => {
    if (!iHoldTheLock || !myId) return;
    sendHeartbeat(myId);   // don't leave the first gap unwritten
    const id = window.setInterval(() => sendHeartbeat(myId), HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [iHoldTheLock, myId, sendHeartbeat, HEARTBEAT_MS]);

  // Who's in — seeded by the scorer, then the rules engine keeps track.
  const [striker, setStriker] = useState<string | null>(null);
  const [nonStriker, setNonStriker] = useState<string | null>(null);
  const [bowler, setBowler] = useState<string | null>(null);
  const [wicketSheet, setWicketSheet] = useState<ExtraType | 'W' | null>(null);
  /**
   * After a wicket the scorer must say who's in, and at the end of an over who's
   * bowling. Prompting beats leaving them to find a dropdown mid-over — that's
   * where a scorer loses the thread and the next ball goes down wrong.
   */
  const [newBatterFor, setNewBatterFor] = useState<'striker' | 'nonStriker' | null>(null);
  const [pickedBatter, setPickedBatter] = useState<string | null>(null);
  const [needBowler, setNeedBowler] = useState(false);

  useEffect(() => {
    if (S.state.strikerId) setStriker(S.state.strikerId);
    if (S.state.nonStrikerId) setNonStriker(S.state.nonStrikerId);
  }, [S.state.strikerId, S.state.nonStrikerId]);

  // Wipe the crease when the innings changes. This page mounts before the
  // innings rows arrive, so it spends its first moments on innings 1 and seeds
  // the batters from it. Once innings 2 loaded, the score cleared but those
  // names stayed in local state — so the chase opened with the side that had
  // just BATTED pre-selected to bat again, one tap away from recording Brahmos
  // players as Agni's openers.
  const prevShown = useRef<1 | 2 | null>(null);
  useEffect(() => {
    if (prevShown.current !== null && prevShown.current !== shown) {
      setStriker(null); setNonStriker(null); setBowler(null);
      // Any pending prompt belongs to the innings that just ended.
      setNeedBowler(false); setNewBatterFor(null); setPickedBatter(null); setWicketSheet(null);
    }
    prevShown.current = shown;
  }, [shown]);

  const name = (id: string | null) =>
    members.find(m => m.id === id)?.name ?? '—';
  const squad = useMemo(
    () => members.filter(m => m.status === 'active').sort((a, b) => a.name.localeCompare(b.name)),
    [members],
  );

  const record = (input: Parameters<typeof S.scoreBall>[0]) => {
    void S.scoreBall(input, { strikerId: striker, nonStrikerId: nonStriker, bowlerId: bowler }, myId);
    setWicketSheet(null);

    // A wicket empties one end — ask who replaces the man who's out. Which end
    // depends on who was actually dismissed, since a run out can take the
    // non-striker.
    if (input.wicketType && input.wicketType !== 'retired') {
      setNewBatterFor(input.dismissedId === nonStriker ? 'nonStriker' : 'striker');
      setPickedBatter(null);
    } else if (S.ctx.ballNo + 1 >= 6 && !input.extraType
               && S.ctx.overNo + 1 < format.oversPerInnings) {
      // Sixth legal ball: the over is done, so a new bowler is needed. Wides
      // and no-balls don't end an over, hence the extras guard.
      //
      // Only when there IS a next over. The last ball of the final over ends
      // the innings, and asking who bowls next put a full-screen "Who's
      // bowling?" list over the innings break — and, because nothing cleared it,
      // over the second innings and the result screen behind it. The scorer had
      // to name a bowler for an over that would never be bowled before they
      // could publish the result.
      setNeedBowler(true);
    }
  };

  /**
   * The things that go wrong mid-match. Every one of these is otherwise only
   * fixable by undoing good deliveries back to the mistake, which is how a
   * scorer loses an innings.
   */
  const [tool, setTool] = useState<'strike' | 'batter' | 'bowler' | 'overs' | 'card' | null>(null);
  const [fixWho, setFixWho] = useState<string | null>(null);
  const [bowlerScope, setBowlerScope] = useState<'rest' | 'over'>('rest');
  const [newOvers, setNewOvers] = useState(String(format.oversPerInnings));

  /**
   * Manual strike change. The engine rotates correctly by the rules, but
   * overthrows, short runs and byes all produce endings only the umpire knows —
   * so the scorer has to be able to say otherwise. No write needed: the next
   * ball records whoever is on strike, and the engine carries on from there.
   */
  const swapStrike = () => {
    setStriker(nonStriker);
    setNonStriker(striker);
    setTool(null);
  };

  /** Overs cut for rain or a late start. Can't go below what's already bowled. */
  const applyOvers = async () => {
    const n = Number(newOvers);
    const bowled = Math.ceil(S.state.legalBalls / 6);
    if (!Number.isFinite(n) || n < 1) return alert('Enter a number of overs.');
    if (n < bowled) return alert(`${bowled} overs are already bowled — can't cut below that.`);
    const { error } = await supabase.from('matches')
      .update({ overs_per_innings: n }).eq('id', matchId);
    if (error) return alert(error.message);
    setTool(null);
    // Refetch rather than reload. A full reload threw away the scorer's striker,
    // non-striker and bowler — so a rain adjustment mid-over made them re-enter
    // all three — and it dropped them out of their own match entirely. `format`
    // is derived from the match record, so refreshing it is all that's needed.
    await fetchMatches();
  };

  /** Everyone who has already batted or is at the crease. */
  const usedBatters = useMemo(() => {
    const ids = new Set<string>();
    S.balls.forEach(b => {
      if (b.striker_id) ids.add(b.striker_id);
      if (b.non_striker_id) ids.add(b.non_striker_id);
    });
    if (striker) ids.add(striker);
    if (nonStriker) ids.add(nonStriker);
    return ids;
  }, [S.balls, striker, nonStriker]);

  if (ADMIN_ONLY_TRIAL && !isAdmin) {
    return (
      <div>
        <Header title="Live Scoring" subtitle="In testing" />
        <div className="p-8 max-w-md mx-auto mt-12 text-center">
          <Card className="p-8">
            <Lock className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <h2 className="text-lg font-black text-slate-900 dark:text-white">Being tested</h2>
            <p className="text-sm text-slate-500 dark:text-white/60 mt-1.5">
              In-app scoring is on trial with the admins. It opens to every member
              once it's proven on a real match 🏏
            </p>
          </Card>
        </div>
      </div>
    );
  }

  if (S.tableMissing) {
    return (
      <div>
        <Header title="Live Scoring" subtitle="Not set up yet" />
        <Card className="p-8 max-w-lg mx-auto mt-10 bg-amber-50 border-amber-200 p-6">
          <p className="font-black text-amber-900">Scoring tables not created yet</p>
          <p className="text-sm text-amber-800/80 mt-1.5">
            Run <code className="font-mono">supabase/migrations/add_scoring_module.sql</code> in the
            Supabase SQL editor, then reload.
          </p>
        </Card>
      </div>
    );
  }

  const st = S.state;
  // Live figures so the scorer sees runs(balls) beside each name, the way every
  // scoring app shows it — a name alone tells you nothing mid-over.
  const bat = battingCard(S.balls);
  const bowl = bowlingCard(S.balls);
  const batLine = (id: string | null) => {
    const l = id ? bat.get(id) : null;
    return l ? `${l.runs} (${l.balls})` : '0 (0)';
  };
  const bowlLine = (id: string | null) => {
    const l = id ? bowl.get(id) : null;
    return l ? `${l.overs}-${l.maidens}-${l.runs}-${l.wickets}` : '0.0-0-0-0';
  };

  return (
    <div className="min-h-screen">
      <Header title="Live Scoring"
        subtitle={match ? `${match.opponent ?? 'Match'} · ${format.oversPerInnings} overs` : 'Match'} />

      <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-4">

        {/* ── SCOREBOARD — the thing everyone looks at ─────────────────── */}
        <div className="relative overflow-hidden r-card text-white shadow-2xl"
          style={{ background: 'linear-gradient(150deg,#052e16,#020617)' }}>
          <div className="p-6 text-center">
            <span className="inline-flex items-center gap-1.5 t-micro font-black uppercase tracking-[2px] text-emerald-300">
              <Radio className="w-3 h-3" /> Innings {innings}
              {S.pending > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-amber-300">
                  <WifiOff className="w-3 h-3" /> {S.pending} queued
                </span>
              )}
            </span>
            <p className="t-num text-6xl mt-2 leading-none">
              {st.runs}<span className="text-white/40">/</span>{st.wickets}
            </p>
            <p className="text-white/60 text-sm mt-1.5">
              {st.overs} / {format.oversPerInnings} overs · RR {st.runRate.toFixed(2)}
            </p>

            {/* batters + bowler — figures inline, striker marked */}
            <div className="grid grid-cols-2 gap-2 mt-5 text-left">
              {[[striker, true], [nonStriker, false]].map(([id, onStrike]) => (
                <div key={String(id) + String(onStrike)}
                  className={`r-card px-3 py-2.5 border ${
                    onStrike ? 'bg-white/15 border-emerald-400/50' : 'bg-white/5 border-white/10'}`}>
                  <p className="t-body font-bold truncate flex items-center gap-1.5">
                    {onStrike && <span className="text-emerald-400">●</span>}
                    {name(id as string | null)}
                  </p>
                  <p className="t-meta text-white/55 tabular-nums">{batLine(id as string | null)}</p>
                </div>
              ))}
            </div>
            <Card className="mt-2 bg-white/5 border-white/10 px-3 py-2 text-left">
              <p className="t-body font-bold truncate">🏐 {name(bowler)}</p>
              <p className="t-meta text-white/55 tabular-nums">{bowlLine(bowler)}</p>
            </Card>

            {/* this over */}
            <div className="flex items-center justify-center gap-1.5 mt-4 flex-wrap">
              <span className="t-micro font-black uppercase tracking-widest text-white/40 mr-1">
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
                    className={`w-8 h-8 r-card t-meta font-black flex items-center justify-center ${
                      wkt ? 'bg-rose-500' : b.runs_off_bat >= 4 ? 'bg-emerald-500'
                      : b.extra_type ? 'bg-amber-500/80' : 'bg-white/15'}`}>
                    {label}
                  </span>
                );
              })}
            </div>

            {S.freeHit && (
              <p className="mt-3 inline-block rounded-full bg-amber-400 text-slate-900 px-3 py-1 t-micro font-black">
                FREE HIT — only run out
              </p>
            )}
            {st.isComplete && (
              <p className="mt-3 inline-block rounded-full bg-white/15 px-4 py-1.5 t-meta font-black">
                Innings complete · {st.completeReason}
              </p>
            )}
          </div>
        </div>

        {/* ── TOSS ─────────────────────────────────────────────────────
            Nothing can be scored until somebody has batted first. */}
        {iAmScoring && M.notStarted && (
          <TossSheet sides={sides}
            onStart={async (battingFirst, bowlingFirst) => {
              const err = await M.startMatch(battingFirst, bowlingFirst);
              if (err) alert(err);
            }} />
        )}

        {/* ── INNINGS BREAK ────────────────────────────────────────────
            First innings done and no chase started yet. */}
        {iAmScoring && M.first && !M.second && st.isComplete && (
          <InningsBreak
            battingTeam={sideName(M.first.batting_team)}
            chasingTeam={sideName(M.first.bowling_team)}
            runs={st.runs} wickets={st.wickets} overs={st.overs}
            onStart={async () => {
              const err = await M.startSecondInnings(st.runs);
              if (err) alert(err); else { setViewing(null); setStriker(null); setNonStriker(null); setBowler(null); }
            }} />
        )}

        {/* ── RESULT ───────────────────────────────────────────────────
            Both innings done: declare it and pick a Man of the Match. */}
        {iAmScoring && M.second && shown === 2 && st.isComplete && (
          <MatchResult
            first={{ team: sideName(M.first?.batting_team), runs: firstInnings.runs,
                     wickets: firstInnings.wickets, overs: firstInnings.overs }}
            second={{ team: sideName(M.second.batting_team), runs: st.runs,
                      wickets: st.wickets, overs: st.overs }}
            allBalls={[...firstInnings.balls, ...S.balls]}
            secondBalls={S.balls}
            members={members} format={format} saving={saving}
            onFinish={async (winner, momId) => {
              setSaving(true);
              const ourFirst = M.first?.batting_team === 'home';
              const err = await M.finishMatch({
                winningTeam: match?.match_type === 'internal'
                  ? (winner === sides[0].name ? 'brahmos' : 'agni') : null,
                ourScore: ourFirst ? `${firstInnings.runs}/${firstInnings.wickets}` : `${st.runs}/${st.wickets}`,
                opponentScore: ourFirst ? `${st.runs}/${st.wickets}` : `${firstInnings.runs}/${firstInnings.wickets}`,
                momId,
                result: match?.match_type === 'internal' ? 'draw'
                  : winner === sides[0].name ? 'won' : 'lost',
              });
              setSaving(false);
              if (err) alert(err); else { await M.closeInnings(2); alert('Result published'); }
            }} />
        )}

        {/* which innings am I looking at — read-only once both exist */}
        {M.rows.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {M.rows.map(r => (
              <button key={r.innings} onClick={() => setViewing(r.innings as 1 | 2)}
                className={`r-control py-2.5 t-body font-black border-2 truncate px-2 ${
                  shown === r.innings
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700'
                    : 'border-slate-200 dark:border-white/10 text-slate-500'}`}>
                {sideName(r.batting_team)} batting
              </button>
            ))}
          </div>
        )}

        {/* ── WHO IS SCORING ───────────────────────────────────────────── */}
        {!iAmScoring && (
          <Card className="p-4">
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
                  className="t-meta font-black text-slate-400">Take over</button>
              </div>
            ) : (
              <button onClick={() => myId && S.claimLock(myId)}
                className="w-full r-control bg-emerald-500 text-white font-black py-3 text-sm">
                Start scoring this match
              </button>
            )}
          </Card>
        )}

        {/* ── THE VIEWER ───────────────────────────────────────────────
            Anyone who isn't the scorer gets the watching experience rather
            than a bare score: commentary, key moments, over-by-over and the
            win probability. Source-agnostic on purpose — see useLiveFeed. */}
        {!iAmScoring && feed.view && (
          <LiveViewer view={feed.view} format={format} name={name} />
        )}

        {/* ── THE PAD ────────────────────────────────────────────────────
            Only once an innings actually exists. The pad used to render
            alongside the toss sheet, so a scorer tapping it while deciding who
            bats first silently recorded balls into an innings nobody had
            started — found by doing exactly that during the trial, which put
            ten phantom deliveries into the opener. */}
        {iAmScoring && !M.notStarted && M.current && (
          <div className="space-y-2.5">
            {/* who's in — only needed at the start of an innings or after a wicket */}
            {(!striker || !nonStriker || !bowler) && (
              <Card className="border-amber-300 bg-amber-50 dark:bg-amber-500/10 p-4 space-y-2">
                <p className="t-meta font-black uppercase tracking-widest text-amber-700">
                  Set the players
                </p>
                {[
                  { l: 'Striker', v: striker, set: setStriker },
                  { l: 'Non-striker', v: nonStriker, set: setNonStriker },
                  { l: 'Bowler', v: bowler, set: setBowler },
                ].map(f => (
                  <select key={f.l} value={f.v ?? ''} onChange={e => f.set(e.target.value || null)}
                    className="w-full r-control border border-amber-200 bg-white px-3 py-2 text-sm">
                    <option value="">{f.l}…</option>
                    {squad.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                ))}
              </Card>
            )}

            {/* ── KEYPAD ────────────────────────────────────────────────
                Laid out like the scoring apps everyone already knows: numbers
                in a grid, boundaries called out, extras along the bottom, OUT
                and undo down the right where the thumb rests. */}
            <div className="grid grid-cols-4 gap-2">
              {/* numbers 0–3 */}
              {[0, 1, 2].map(r => (
                <button key={r} onClick={() => record({ runsOffBat: r })} disabled={st.isComplete}
                  className="h-16 r-control bg-white dark:bg-white/10 border-2 border-slate-200
                             dark:border-white/10 font-display text-2xl font-extrabold
                             text-slate-900 dark:text-white disabled:opacity-30 active:scale-95 transition-transform">
                  {r}
                </button>
              ))}
              <button onClick={() => S.undoBall()} disabled={S.balls.length === 0}
                className="h-16 r-control bg-slate-100 dark:bg-white/10 border-2 border-slate-200
                           dark:border-white/10 text-slate-500 disabled:opacity-30
                           inline-flex items-center justify-center active:scale-95 transition-transform">
                <Undo2 className="w-5 h-5" />
              </button>

              <button onClick={() => record({ runsOffBat: 3 })} disabled={st.isComplete}
                className="h-16 r-control bg-white dark:bg-white/10 border-2 border-slate-200
                           dark:border-white/10 font-display text-2xl font-extrabold
                           text-slate-900 dark:text-white disabled:opacity-30 active:scale-95 transition-transform">
                3
              </button>
              {[4, 6].map(r => (
                <button key={r} onClick={() => record({ runsOffBat: r })} disabled={st.isComplete}
                  className={`h-16 r-control font-display text-2xl font-extrabold text-white
                              disabled:opacity-30 active:scale-95 transition-transform ${
                    r === 4 ? 'bg-amber-500' : 'bg-emerald-500'}`}>
                  {r}
                  <span className="block t-micro font-bold tracking-widest opacity-80">BOUNDARY</span>
                </button>
              ))}
              <button onClick={() => setWicketSheet('W')} disabled={st.isComplete}
                className="h-16 r-control bg-rose-500 text-white font-black text-lg
                           disabled:opacity-30 active:scale-95 transition-transform">
                OUT
              </button>
            </div>

            {/* extras */}
            <div className="grid grid-cols-4 gap-2">
              {EXTRAS.map(x => (
                <button key={x.key} onClick={() => setWicketSheet(x.key)} disabled={st.isComplete}
                  className="h-14 r-control bg-amber-50 dark:bg-amber-500/10 border-2 border-amber-200
                             dark:border-amber-400/20 text-amber-700 dark:text-amber-300
                             disabled:opacity-30 active:scale-95 transition-transform">
                  <span className="block font-black t-body uppercase">{x.key}</span>
                  <span className="block t-micro font-bold opacity-70">{x.label}</span>
                </button>
              ))}
            </div>

            {/* ── Fix it ─────────────────────────────────────────────────
                Undo only walks back one ball at a time, so without these the
                only way to correct a name three overs later is to destroy three
                overs of good scoring. Kept small and out of the way: these are
                rare taps, and nothing here should compete with the run buttons. */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { k: 'strike' as const, icon: Repeat, label: 'Strike' },
                { k: 'batter' as const, icon: Users, label: 'Batter' },
                { k: 'bowler' as const, icon: Wrench, label: 'Bowler' },
                { k: 'card' as const, icon: ClipboardList, label: 'Card' },
              ].map(t => (
                <button key={t.k} onClick={() => { setFixWho(null); setTool(t.k); }}
                  className="h-12 r-control bg-slate-100 dark:bg-white/5 border border-slate-200
                             dark:border-white/10 text-slate-500 dark:text-white/60
                             inline-flex flex-col items-center justify-center gap-0.5
                             active:scale-95 transition-transform">
                  <t.icon className="w-4 h-4" />
                  <span className="t-micro font-black uppercase tracking-wider">{t.label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <button onClick={() => { setNewOvers(String(format.oversPerInnings)); setTool('overs'); }}
                className="t-meta font-bold text-slate-400 py-1">
                Change overs ({format.oversPerInnings})
              </button>
              <button onClick={() => S.releaseLock()}
                className="t-meta font-bold text-slate-400 py-1">
                Hand over scoring
              </button>
            </div>
          </div>
        )}

        {/* ── NEXT BATTER ──────────────────────────────────────────────
            Two questions, in the order the scorer answers them out loud: who's
            coming in, then which end. The end matters — on a run out the batters
            may have crossed, so the new man doesn't always take strike. */}
        {newBatterFor && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/60" />
            <div className="relative w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-5 max-h-[85vh] overflow-y-auto">
              <p className="t-micro font-black uppercase tracking-widest text-rose-500">
                Wicket · {st.wickets} down
              </p>
              <p className="font-black text-lg text-slate-900 dark:text-white mt-0.5">
                {pickedBatter ? 'Which end?' : 'Who’s in next?'}
              </p>

              {!pickedBatter ? (
                <div className="mt-3 space-y-1.5">
                  {squad.filter(m => !usedBatters.has(m.id)).map(m => (
                    <button key={m.id} onClick={() => setPickedBatter(m.id)}
                      className="w-full text-left r-control border-2 border-slate-200 dark:border-white/10
                                 px-3.5 py-3 font-bold t-body text-slate-800 dark:text-white/85
                                 active:scale-[0.99] transition-transform">
                      {m.name}
                    </button>
                  ))}
                  {squad.filter(m => !usedBatters.has(m.id)).length === 0 && (
                    <p className="text-sm text-slate-500 py-3">
                      Everyone has batted — the innings is done.
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  <p className="t-body text-slate-500">
                    <b className="text-slate-900 dark:text-white">{name(pickedBatter)}</b> comes in.
                  </p>
                  <button onClick={() => {
                    // New batter takes strike; whoever survived goes to the other end.
                    const survivor = newBatterFor === 'striker' ? nonStriker : striker;
                    setStriker(pickedBatter); setNonStriker(survivor);
                    setPickedBatter(null); setNewBatterFor(null);
                  }}
                    className="w-full r-control bg-emerald-500 text-white font-black py-3.5 text-sm">
                    On strike
                  </button>
                  <button onClick={() => {
                    const survivor = newBatterFor === 'striker' ? nonStriker : striker;
                    setStriker(survivor); setNonStriker(pickedBatter);
                    setPickedBatter(null); setNewBatterFor(null);
                  }}
                    className="w-full r-control border-2 border-slate-200 dark:border-white/10
                               font-black py-3.5 text-sm text-slate-700 dark:text-white/80">
                    At the non-striker’s end
                  </button>
                  <button onClick={() => setPickedBatter(null)}
                    className="w-full t-meta font-bold text-slate-400 pt-1">Back</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── NEXT BOWLER ──────────────────────────────────────────────
            Anyone ineligible is filtered out rather than shown and rejected —
            the scorer shouldn't have to remember who bowled last over or who's
            reached their quota. */}
        {needBowler && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/60" />
            <div className="relative w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-5 max-h-[85vh] overflow-y-auto">
              <p className="t-micro font-black uppercase tracking-widest text-emerald-600">
                End of over {S.ctx.overNo}
              </p>
              <p className="font-black text-lg text-slate-900 dark:text-white mt-0.5">
                Who’s bowling?
              </p>
              <div className="mt-3 space-y-1.5">
                {squad.filter(m => !S.ctx.ineligibleBowlers.includes(m.id)).map(m => {
                  const l = bowl.get(m.id);
                  return (
                    <button key={m.id} onClick={() => { setBowler(m.id); setNeedBowler(false); }}
                      className="w-full flex items-center justify-between r-control border-2
                                 border-slate-200 dark:border-white/10 px-3.5 py-3 active:scale-[0.99] transition-transform">
                      <span className="font-bold t-body text-slate-800 dark:text-white/85">{m.name}</span>
                      {l && (
                        <span className="t-meta tabular-nums text-slate-400">
                          {l.overs}-{l.maidens}-{l.runs}-{l.wickets}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="t-micro text-slate-400 mt-3">
                Last over’s bowler and anyone at their {format.maxOversPerBowler}-over limit are hidden.
              </p>
            </div>
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
                      className="r-control border-2 border-slate-200 dark:border-white/10 py-3
                                 font-black t-body text-slate-700 dark:text-white/80">
                      {w.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {/* Same +0..+5 grid for every extra, labelled the way it's
                      called: "wd+2" is a wide the batters ran two off. For a
                      wide or no-ball the +1 penalty is added on top; for byes
                      and leg-byes the number IS the runs, since there's no
                      penalty. Uniform grid, correct arithmetic underneath. */}
                  {[0, 1, 2, 3, 4, 5].map(n => {
                    const penalty = wicketSheet === 'wd' || wicketSheet === 'nb' ? 1 : 0;
                    return (
                      <button key={n}
                        onClick={() => record({
                          extraType: wicketSheet as ExtraType,
                          extraRuns: penalty + n,
                          runsOffBat: 0,
                        })}
                        className="h-16 r-control border-2 border-amber-200 dark:border-amber-400/20
                                   bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300
                                   active:scale-95 transition-transform">
                        <span className="block font-display text-xl font-extrabold">
                          {wicketSheet}+{n}
                        </span>
                        <span className="block t-micro font-bold opacity-70">
                          {penalty + n} run{penalty + n === 1 ? '' : 's'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <button onClick={() => setWicketSheet(null)}
                className="w-full t-meta font-bold text-slate-400 pt-1">Cancel</button>
            </div>
          </div>
        )}

        {/* ── CORRECTIONS + FULL CARD ──────────────────────────────────── */}
        {tool && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center
                          justify-center p-3" onClick={() => setTool(null)}>
            <div onClick={e => e.stopPropagation()}
              className="w-full max-w-md max-h-[85vh] overflow-y-auto r-card bg-white dark:bg-slate-900
                         border border-slate-200 dark:border-white/10 p-5 space-y-3">

              {tool === 'strike' && (
                <>
                  <h3 className="font-black text-slate-900 dark:text-white">Change strike</h3>
                  <p className="t-body text-slate-500">
                    Overthrows, short runs and byes can leave the batters at ends the
                    rules alone don't predict. This puts them where the umpire says.
                  </p>
                  <div className="r-card bg-slate-50 dark:bg-white/5 p-3 text-sm">
                    <p><span className="text-emerald-500">●</span> <b>{name(striker)}</b> on strike</p>
                    <p className="text-slate-500">{name(nonStriker)} at the other end</p>
                  </div>
                  <button onClick={swapStrike}
                    className="w-full py-3 r-control bg-emerald-500 text-white font-black">
                    Swap them over
                  </button>
                </>
              )}

              {tool === 'batter' && (
                <>
                  <h3 className="font-black text-slate-900 dark:text-white">Wrong batter</h3>
                  <p className="t-body text-slate-500">
                    Picks the right player and rewrites the balls faced during this
                    stay at the crease. Earlier innings by the same name aren't touched.
                  </p>
                  <div className="flex gap-2">
                    {[striker, nonStriker].map(id => (
                      <button key={String(id)} onClick={() => setFixWho(id)}
                        className={`flex-1 py-2.5 r-control t-body font-black border-2 ${
                          fixWho === id
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600'
                            : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70'}`}>
                        {name(id)}
                      </button>
                    ))}
                  </div>
                  {fixWho && (
                    <>
                      <p className="t-meta font-black uppercase tracking-wider text-slate-400 pt-1">
                        Should have been
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {squad.filter(m => m.id !== striker && m.id !== nonStriker && !usedBatters.has(m.id))
                          .map(m => (
                            <button key={m.id}
                              onClick={async () => {
                                await S.correctBatter(fixWho, m.id);
                                if (striker === fixWho) setStriker(m.id); else setNonStriker(m.id);
                                setTool(null);
                              }}
                              className="py-2.5 r-control border border-slate-200 dark:border-white/10
                                         t-body font-bold text-slate-700 dark:text-white/80 truncate px-2">
                              {m.name}
                            </button>
                          ))}
                      </div>
                    </>
                  )}
                </>
              )}

              {tool === 'bowler' && (
                <>
                  <h3 className="font-black text-slate-900 dark:text-white">Replace bowler</h3>
                  <p className="t-body text-slate-500">
                    For an injury mid-over. The replacement finishes the over and the
                    figures split between them — each keeps the balls they bowled.
                  </p>
                  <div className="flex gap-2">
                    {[
                      { k: 'rest' as const, l: 'From here on', h: 'injury mid-over' },
                      { k: 'over' as const, l: 'This whole over', h: 'wrong name all along' },
                    ].map(o => (
                      <button key={o.k} onClick={() => setBowlerScope(o.k)}
                        className={`flex-1 py-2 r-control border-2 ${
                          bowlerScope === o.k
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600'
                            : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70'}`}>
                        <span className="block t-body font-black">{o.l}</span>
                        <span className="block t-micro opacity-70">{o.h}</span>
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {squad.filter(m => m.id !== bowler).map(m => (
                      <button key={m.id}
                        onClick={async () => {
                          // "From here on" needs no rewrite — the next ball simply
                          // records the new name, and figures aggregate per ball.
                          // "This whole over" hands back the balls already bowled.
                          if (bowlerScope === 'over' && st.thisOver.length) {
                            await S.reassignBowler(st.thisOver[0].seq, m.id);
                          }
                          setBowler(m.id);
                          setTool(null);
                        }}
                        className="py-2.5 r-control border border-slate-200 dark:border-white/10
                                   t-body font-bold text-slate-700 dark:text-white/80 truncate px-2">
                        {m.name}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {tool === 'overs' && (
                <>
                  <h3 className="font-black text-slate-900 dark:text-white">Change overs</h3>
                  <p className="t-body text-slate-500">
                    Rain, a late start, or teams agreeing to cut it short. Applies to
                    both innings — it can't go below the overs already bowled.
                  </p>
                  <input type="number" inputMode="numeric" value={newOvers}
                    onChange={e => setNewOvers(e.target.value)}
                    className="w-full text-center font-display text-4xl font-extrabold py-3 r-control
                               bg-slate-50 dark:bg-white/5 border-2 border-slate-200 dark:border-white/10
                               text-slate-900 dark:text-white" />
                  <button onClick={applyOvers}
                    className="w-full py-3 r-control bg-emerald-500 text-white font-black">
                    Set overs
                  </button>
                </>
              )}

              {tool === 'card' && (
                <>
                  <h3 className="font-black text-slate-900 dark:text-white">
                    Full scorecard · {sideName(M.rows.find(r => r.innings === shown)?.batting_team)}
                  </h3>
                  <table className="w-full t-body">
                    <thead>
                      <tr className="text-slate-400 t-micro uppercase tracking-wider">
                        <th className="text-left py-1">Batter</th><th className="text-right">R</th>
                        <th className="text-right">B</th><th className="text-right">4s</th>
                        <th className="text-right">6s</th><th className="text-right">SR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...battingCard(S.balls).values()].map(b => (
                        <tr key={b.memberId} className="border-t border-slate-100 dark:border-white/5">
                          <td className="py-1.5 font-bold text-slate-800 dark:text-white/85 truncate max-w-[120px]">
                            {name(b.memberId)}
                            {!b.out && <span className="text-emerald-500 font-normal"> *</span>}
                          </td>
                          <td className="text-right font-black tabular-nums">{b.runs}</td>
                          <td className="text-right tabular-nums text-slate-500">{b.balls}</td>
                          <td className="text-right tabular-nums text-slate-500">{b.fours}</td>
                          <td className="text-right tabular-nums text-slate-500">{b.sixes}</td>
                          <td className="text-right tabular-nums text-slate-500">{b.strikeRate.toFixed(0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <table className="w-full t-body pt-2">
                    <thead>
                      <tr className="text-slate-400 t-micro uppercase tracking-wider">
                        <th className="text-left py-1">Bowler</th><th className="text-right">O</th>
                        <th className="text-right">M</th><th className="text-right">R</th>
                        <th className="text-right">W</th><th className="text-right">Econ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...bowlingCard(S.balls).values()].map(b => (
                        <tr key={b.memberId} className="border-t border-slate-100 dark:border-white/5">
                          <td className="py-1.5 font-bold text-slate-800 dark:text-white/85 truncate max-w-[120px]">
                            {name(b.memberId)}
                          </td>
                          <td className="text-right tabular-nums">{b.overs}</td>
                          <td className="text-right tabular-nums text-slate-500">{b.maidens}</td>
                          <td className="text-right tabular-nums">{b.runs}</td>
                          <td className="text-right font-black tabular-nums">{b.wickets}</td>
                          <td className="text-right tabular-nums text-slate-500">{b.economy.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              <button onClick={() => setTool(null)}
                className="w-full t-meta font-bold text-slate-400 pt-1">Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LiveScoring;
