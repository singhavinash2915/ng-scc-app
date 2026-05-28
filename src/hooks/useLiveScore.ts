import { useState, useEffect, useCallback } from 'react';

export interface LiveScoreData {
  battingTeam: string;
  bowlingTeam: string;
  score: string;
  overs: string;
  runRate: string;
  requiredRunRate: string;
  battingFirst: boolean;
  batsman1: string;
  batsman2: string;
  bowler: string;
  result: string; // empty = in progress, filled = match over
  currentOver: string[];
  lastUpdated: Date;
}

const POLL_INTERVAL = 15000; // 15 seconds

function oversToDecimal(overs: string): number {
  const clean = overs.replace(/[()a-zA-Z\s]/g, '');
  const [o = '0', b = '0'] = clean.split('.');
  return parseInt(o) + parseInt(b) / 6;
}

function getRuns(balls: string, strikeRate: string): string {
  const b = parseInt(balls);
  const sr = parseFloat(strikeRate);
  if (isNaN(b) || isNaN(sr) || b === 0) return '0';
  return Math.round((b * sr) / 100).toString();
}

function calcRunsConceded(economy: number, oversBowled: number): string {
  if (isNaN(economy) || isNaN(oversBowled) || oversBowled === 0) return '0';
  const ov = Math.floor(oversBowled);
  const bl = Math.round((oversBowled - ov) * 10);
  const totalBalls = ov * 6 + bl;
  return Math.round(economy * (totalBalls / 6)).toString();
}

function qsEl(doc: Document, sel: string, n = 0): HTMLElement | null {
  return (Array.from(doc.querySelectorAll(sel))[n] as HTMLElement) ?? null;
}

function qt(doc: Document, sel: string, n = 0): string {
  return qsEl(doc, sel, n)?.textContent?.trim() ?? '';
}

function parseScorecard(html: string): Omit<LiveScoreData, 'lastUpdated'> | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const runRate = qt(doc, '.runRateStat', 0);
    const requiredRunRate = qt(doc, '.runRateStat', 1);
    const battingFirst = !requiredRunRate || requiredRunRate.includes('RPO');

    const overs = battingFirst ? qt(doc, '.bfKBqI', 0) : qt(doc, '.bfKBqI', 1);
    const battingTeam = qt(doc, '.iwkYwe', 0);
    const bowlingTeam = qt(doc, '.jZwYNW', 0);

    // Current over balls
    const balls = qt(doc, '.balls', 0);
    const current = balls ? balls.split('|') : [];
    const currentOver = current.length
      ? current[current.length - 1].trim().replace(/\s+/g, '').split('')
      : [];

    const tables = doc.querySelectorAll('table');

    // ── Batsmen ──────────────────────────────────────────────────────────────
    const bat1Row = tables[0]?.querySelectorAll('tbody tr')[0];
    const bat1Balls = bat1Row?.querySelectorAll('td')[2]?.textContent?.trim() ?? '';
    const bat1SR    = bat1Row?.querySelectorAll('td')[5]?.textContent?.trim() ?? '';
    const bat1Name  = (bat1Row?.querySelector('td span a span') as HTMLElement)?.textContent?.trim() ?? '';
    const batsman1  = bat1Name ? `${bat1Name}: ${getRuns(bat1Balls, bat1SR)} (${bat1Balls})` : '';

    const bat2Row = tables[0]?.querySelectorAll('tbody tr')[1];
    const bat2Balls = bat2Row?.querySelectorAll('td')[2]?.textContent?.trim() ?? '';
    const bat2SR    = bat2Row?.querySelectorAll('td')[5]?.textContent?.trim() ?? '';
    const bat2Name  = (bat2Row?.querySelector('td span a span') as HTMLElement)?.textContent?.trim() ?? '';
    const batsman2  = bat2Name ? `${bat2Name}: ${getRuns(bat2Balls, bat2SR)} (${bat2Balls})` : '';

    // ── Bowler ───────────────────────────────────────────────────────────────
    const bwlRow = tables[1]?.querySelectorAll('tbody tr')[0];
    const bwlrOvers   = bwlRow?.querySelectorAll('td')[1]?.textContent?.trim() ?? '';
    const bwlrMaidens = bwlRow?.querySelectorAll('td')[2]?.textContent?.trim() ?? '';
    const bwlrEconomy = bwlRow?.querySelectorAll('td')[5]?.textContent?.trim() ?? '';
    const bwlrWickets = bwlRow?.querySelectorAll('td')[4]?.textContent?.trim() ?? '';
    const bwlrName    = (bwlRow?.querySelector('td span a span') as HTMLElement)?.textContent?.trim() ?? '';
    const runs = calcRunsConceded(parseFloat(bwlrEconomy), parseFloat(bwlrOvers));
    const bowler = bwlrName
      ? `${bwlrName}: ${bwlrOvers}-${bwlrMaidens}-${runs}-${bwlrWickets}`
      : '';

    // ── Match result ─────────────────────────────────────────────────────────
    const matchOver = (doc.querySelector('.jMCptV') as HTMLElement)?.textContent?.trim() ?? '';
    const result = matchOver
      ? (doc.querySelector('.HcRBV') as HTMLElement)?.textContent?.trim() ?? ''
      : '';

    // ── Score (CRR × overs) ──────────────────────────────────────────────────
    const decOvers = oversToDecimal(overs);
    const score = decOvers > 0 && runRate
      ? Math.round(parseFloat(runRate) * decOvers).toString()
      : '';

    return {
      battingTeam, bowlingTeam, score, overs, runRate,
      requiredRunRate, battingFirst, batsman1, batsman2,
      bowler, result, currentOver,
    };
  } catch {
    return null;
  }
}

export function useLiveScore(chMatchId: string | null | undefined) {
  const [data, setData]           = useState<LiveScoreData | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [countdown, setCountdown] = useState(POLL_INTERVAL / 1000);

  const fetchScore = useCallback(async () => {
    if (!chMatchId) return;
    setLoading(true);
    setError(null);
    try {
      const matchUrl  = `https://cricheroes.com/scorecard/${chMatchId}/x/x/live`;
      const proxyUrl  = `https://api.allorigins.win/get?url=${encodeURIComponent(matchUrl)}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error('proxy error');
      const json = await res.json();
      const parsed = parseScorecard(json.contents ?? '');
      if (parsed) {
        setData({ ...parsed, lastUpdated: new Date() });
      } else {
        setError('Could not parse scorecard');
      }
    } catch {
      setError('Live score unavailable');
    } finally {
      setLoading(false);
      setCountdown(POLL_INTERVAL / 1000);
    }
  }, [chMatchId]);

  // Poll every 15 seconds
  useEffect(() => {
    if (!chMatchId) return;
    fetchScore();
    const poll = setInterval(fetchScore, POLL_INTERVAL);
    return () => clearInterval(poll);
  }, [chMatchId, fetchScore]);

  // Countdown ticker
  useEffect(() => {
    if (!chMatchId) return;
    const tick = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(tick);
  }, [chMatchId]);

  return { data, loading, error, countdown, refetch: fetchScore };
}
