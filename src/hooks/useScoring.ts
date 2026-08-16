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
    if (error || !data) { setLockHolder(null); setLockFresh(false); return; }
    const age = Date.now() - new Date(data.heartbeat_at).getTime();
    setLockHolder(data.scorer_id);
    setLockFresh(age < LOCK_STALE_MS);
  }, [matchId]);

  useEffect(() => { void readLock(); }, [readLock]);

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

  return {
    balls, state, ctx, freeHit, loading, tableMissing,
    lockHolder, lockFresh, claimLock, releaseLock, heartbeat,
    scoreBall, undoBall, pending, flush, refetch: fetchBalls,
    HEARTBEAT_MS,
  };
}
