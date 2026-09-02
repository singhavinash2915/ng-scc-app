import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  inningsState, nextBallContext, isFreeHit, DEFAULT_FORMAT,
  type Ball, type MatchFormat, type ExtraType, type WicketType,
} from '../lib/cricketRules';

// ─── Scoring a live match ──────────────────────────────────────────────────────
// Any member with a profile can score. One at a time: the lock is claimed and
// refreshed every 20s, and goes stale after 90s so a dead phone doesn't lock the
// match out for good.
//
// Offline first, because Four Star at 7am has poor signal. Every ball is written
// to localStorage the instant it's tapped and queued for the network — the UI
// never waits on a request, and a lost connection costs nothing.
//
// Egress: viewers fetch only balls after the last seq they hold, so a poll is a
// few hundred bytes rather than the whole innings.

const LOCK_STALE_MS = 90_000;
const HEARTBEAT_MS = 20_000;
const POLL_MS = 10_000;

const queueKey = (matchId: string, innings: number) => `scc-scoring-q-${matchId}-${innings}`;

const isMissing = (e: { code?: string; message: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205');

export interface ScoreInput {
  runsOffBat?: number;
  extraType?: ExtraType | null;
  extraRuns?: number;
  wicketType?: WicketType | null;
  dismissedId?: string | null;
  fielderId?: string | null;
}

export function useScoring(
  matchId: string | null,
  innings: 1 | 2,
  format: MatchFormat = DEFAULT_FORMAT,
  target?: number | null,
) {
  const [balls, setBalls] = useState<Ball[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [lockHolder, setLockHolder] = useState<string | null>(null);
  const [lockFresh, setLockFresh] = useState(false);
  const [pending, setPending] = useState(0);
  const lastSeq = useRef(-1);
  /** Which innings `lastSeq` belongs to. See fetchBalls. */
  const cursorInnings = useRef<number | null>(null);

  // ── Offline queue ──────────────────────────────────────────────────────
  const readQueue = useCallback((): Ball[] => {
    if (!matchId) return [];
    try { return JSON.parse(localStorage.getItem(queueKey(matchId, innings)) || '[]'); }
    catch { return []; }
  }, [matchId, innings]);

  const writeQueue = useCallback((q: Ball[]) => {
    if (!matchId) return;
    localStorage.setItem(queueKey(matchId, innings), JSON.stringify(q));
    setPending(q.length);
  }, [matchId, innings]);

  /** Push anything queued while offline. Safe to call often. */
  const flush = useCallback(async () => {
    if (!matchId) return;
    const q = readQueue();
    if (q.length === 0) return;
    const { error } = await supabase.from('scc_ball_by_ball').upsert(
      q.map(b => ({ ...b, match_id: matchId, innings })),
      { onConflict: 'match_id,innings,seq' },
    );
    if (!error) writeQueue([]);
  }, [matchId, innings, readQueue, writeQueue]);

  // ── Load / poll ────────────────────────────────────────────────────────
  const fetchBalls = useCallback(async (delta = true) => {
    if (!matchId) { setLoading(false); return; }

    // The delta cursor belongs to ONE innings. This hook is mounted before the
    // innings rows have loaded, so it starts on innings 1, reads that innings to
    // the end, and leaves lastSeq at its final ball. When it then switched to
    // innings 2 the cursor came along, and the chase was polled as
    // "seq > 12" — so the first 13 deliveries of the second innings would never
    // have loaded. The pad showed the first innings' score under an INNINGS 2
    // heading and declared it already complete, which puts the result screen up
    // with the wrong side's total. Tie the cursor to its innings and start clean
    // whenever that changes, rather than relying on a reset effect landing first.
    if (cursorInnings.current !== innings) {
      cursorInnings.current = innings;
      lastSeq.current = -1;
      delta = false;
    }

    let q = supabase.from('scc_ball_by_ball')
      .select('*').eq('match_id', matchId).eq('innings', innings).order('seq');
    // Only what we don't already have — keeps a live poll tiny.
    if (delta && lastSeq.current >= 0) q = q.gt('seq', lastSeq.current);

    const { data, error } = await q;
    if (isMissing(error)) { setTableMissing(true); setLoading(false); return; }
    setTableMissing(false);

    const rows = (data as Ball[]) ?? [];
    if (rows.length) {
      lastSeq.current = Math.max(lastSeq.current, ...rows.map(r => r.seq));
      setBalls(prev => {
        const merged = delta ? [...prev, ...rows] : rows;
        const seen = new Set<number>();
        return merged.filter(b => !seen.has(b.seq) && seen.add(b.seq)).sort((a, b) => a.seq - b.seq);
      });
    } else if (!delta) {
      setBalls([]);
    }
    setLoading(false);
  }, [matchId, innings]);

  useEffect(() => {
    lastSeq.current = -1;
    void fetchBalls(false);
    setPending(readQueue().length);
  }, [fetchBalls, readQueue]);

  useEffect(() => {
    const id = window.setInterval(() => { void fetchBalls(true); void flush(); }, POLL_MS);
    return () => window.clearInterval(id);
  }, [fetchBalls, flush]);

  // ── The lock ───────────────────────────────────────────────────────────
  const readLock = useCallback(async () => {
    if (!matchId) return;
    const { data, error } = await supabase
      .from('scc_scoring_lock').select('*').eq('match_id', matchId).maybeSingle();
    // A read that FAILED is not evidence that nobody is scoring. This used to
    // clear the holder on any error, and since the lock was read exactly once
    // per mount and never again, a single dropped request left the scorer
    // looking at "Start scoring this match" in the middle of their own match —
    // and because the heartbeat only runs while you hold the lock, theirs then
    // went stale and another admin could take it. Keep the last known answer
    // and let the poll below try again.
    if (error) return;
    if (!data) { setLockHolder(null); setLockFresh(false); return; }
    const age = Date.now() - new Date(data.heartbeat_at).getTime();
    setLockHolder(data.scorer_id);
    setLockFresh(age < LOCK_STALE_MS);
  }, [matchId]);

  // Re-read on the same cadence as the balls. One read on mount was enough only
  // as long as nothing ever went wrong on that one read.
  useEffect(() => {
    void readLock();
    const id = window.setInterval(() => { void readLock(); }, POLL_MS);
    return () => window.clearInterval(id);
  }, [readLock]);

  const claimLock = useCallback(async (scorerId: string) => {
    if (!matchId) return 'No match';
    const { error } = await supabase.from('scc_scoring_lock').upsert(
      { match_id: matchId, scorer_id: scorerId, heartbeat_at: new Date().toISOString() },
      { onConflict: 'match_id' },
    );
    if (error) return error.message;
    await readLock();
    return null;
  }, [matchId, readLock]);

  const releaseLock = useCallback(async () => {
    if (!matchId) return;
    await supabase.from('scc_scoring_lock').delete().eq('match_id', matchId);
    await readLock();
  }, [matchId, readLock]);

  /** Keep the lock alive while this scorer has the page open. */
  const heartbeat = useCallback((scorerId: string) => {
    if (!matchId) return;
    void supabase.from('scc_scoring_lock')
      .update({ heartbeat_at: new Date().toISOString() })
      .eq('match_id', matchId).eq('scorer_id', scorerId);
  }, [matchId]);

  // ── Derived state ──────────────────────────────────────────────────────
  const state = useMemo(() => inningsState(balls, format, target), [balls, format, target]);
  const ctx = useMemo(() => nextBallContext(balls, format), [balls, format]);
  const freeHit = useMemo(() => isFreeHit(balls), [balls]);

  // ── Scoring a ball ─────────────────────────────────────────────────────
  /**
   * Record one delivery. Writes to local state and the offline queue first so
   * the scorer sees it instantly, then syncs — a slow network must never make
   * the next ball wait.
   */
  const scoreBall = useCallback(async (
    input: ScoreInput,
    who: { strikerId: string | null; nonStrikerId: string | null; bowlerId: string | null },
    scorerId: string | null,
  ) => {
    if (!matchId) return;
    const seq = (balls[balls.length - 1]?.seq ?? -1) + 1;
    const ball: Ball = {
      seq,
      over_no: ctx.overNo,
      ball_no: ctx.ballNo,
      striker_id: who.strikerId,
      non_striker_id: who.nonStrikerId,
      bowler_id: who.bowlerId,
      runs_off_bat: input.runsOffBat ?? 0,
      extra_type: input.extraType ?? null,
      extra_runs: input.extraRuns ?? 0,
      wicket_type: input.wicketType ?? null,
      dismissed_id: input.dismissedId ?? null,
      fielder_id: input.fielderId ?? null,
    };

    setBalls(prev => [...prev, ball]);
    lastSeq.current = Math.max(lastSeq.current, seq);

    const { error } = await supabase.from('scc_ball_by_ball')
      .insert({ ...ball, match_id: matchId, innings, created_by: scorerId });
    // Offline or a blip: keep it locally and let flush() catch up.
    if (error) writeQueue([...readQueue(), ball]);
  }, [matchId, innings, balls, ctx, readQueue, writeQueue]);

  /** Take back the last delivery. Recomputes everything — no running totals. */
  const undoBall = useCallback(async () => {
    const last = balls[balls.length - 1];
    if (!last || !matchId) return;
    setBalls(prev => prev.slice(0, -1));
    lastSeq.current = (balls[balls.length - 2]?.seq ?? -1);
    await supabase.from('scc_ball_by_ball')
      .delete().eq('match_id', matchId).eq('innings', innings).eq('seq', last.seq);
    writeQueue(readQueue().filter(b => b.seq !== last.seq));
  }, [balls, matchId, innings, readQueue, writeQueue]);

  /**
   * The scorer picked the wrong batter and only noticed a few balls later.
   *
   * Undo would mean unwinding every good ball in between just to fix a name, so
   * instead we rewrite the balls the wrong player is on — but only for their
   * CURRENT stay at the crease. Anything before they came in belongs to a
   * genuinely different batter and must not be touched, which is why this walks
   * back from the last ball to find where the run of their name starts.
   *
   * dismissed_id is deliberately left alone: someone at the crease to be
   * corrected hasn't been dismissed, so any such row is a different event.
   */
  const correctBatter = useCallback(async (wrongId: string, rightId: string) => {
    if (!matchId || wrongId === rightId) return;
    const onIt = (b: Ball) => b.striker_id === wrongId || b.non_striker_id === wrongId;

    // Walk back while the wrong player is continuously at the crease.
    let from = balls.length;
    while (from > 0 && onIt(balls[from - 1])) from--;
    if (from >= balls.length) return;              // never actually faced

    const touched = balls.slice(from).filter(onIt);
    const fix = (b: Ball): Ball => ({
      ...b,
      striker_id: b.striker_id === wrongId ? rightId : b.striker_id,
      non_striker_id: b.non_striker_id === wrongId ? rightId : b.non_striker_id,
    });
    setBalls(prev => prev.map(b => (b.seq >= balls[from].seq && onIt(b) ? fix(b) : b)));

    for (const b of touched) {
      const f = fix(b);
      await supabase.from('scc_ball_by_ball')
        .update({ striker_id: f.striker_id, non_striker_id: f.non_striker_id })
        .eq('match_id', matchId).eq('innings', innings).eq('seq', b.seq);
    }
  }, [matchId, innings, balls]);

  /**
   * Reassign a delivery to a different bowler — the injury case, where a
   * replacement finishes someone else's over.
   *
   * Nothing special is needed to split the over between them: figures are
   * aggregated per ball by bowler_id, so changing the owner of the remaining
   * balls gives both bowlers exactly the deliveries they sent down.
   */
  const reassignBowler = useCallback(async (fromSeq: number, bowlerId: string) => {
    if (!matchId) return;
    const affected = balls.filter(b => b.seq >= fromSeq);
    if (!affected.length) return;
    setBalls(prev => prev.map(b => (b.seq >= fromSeq ? { ...b, bowler_id: bowlerId } : b)));
    for (const b of affected) {
      await supabase.from('scc_ball_by_ball').update({ bowler_id: bowlerId })
        .eq('match_id', matchId).eq('innings', innings).eq('seq', b.seq);
    }
  }, [matchId, innings, balls]);

  return {
    balls, state, ctx, freeHit, loading, tableMissing,
    lockHolder, lockFresh, claimLock, releaseLock, heartbeat,
    scoreBall, undoBall, correctBatter, reassignBowler,
    pending, flush, refetch: fetchBalls,
    HEARTBEAT_MS,
  };
}
