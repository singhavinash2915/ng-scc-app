import { useMemo } from 'react';
import { useScoring } from './useScoring';
import { useMatchInnings } from './useMatchInnings';
import { useLiveScore } from './useLiveScore';
import { legalCount } from '../lib/liveMatch';
import type { LiveView } from '../components/LiveViewer';
import type { MatchFormat } from '../lib/cricketRules';

// ─── One feed, either source ──────────────────────────────────────────────────
// The club scores on CricHeroes normally and in the app when CricHeroes is down
// — which is the whole reason the scoring module exists. So the viewer must not
// care which one is running: a viewer wired only to CricHeroes would go dark in
// precisely the situation the pad was built to survive.
//
// The app wins when it has data. If we're entering balls ourselves, that record
// is the authoritative one — matches.scoring_source already says so, and the
// CricHeroes sync is blocked from overwriting it.

export function useLiveFeed(
  matchId: string | null,
  chMatchId: string | null | undefined,
  format: MatchFormat,
  sides: { home: string; away: string },
) {
  const M = useMatchInnings(matchId);
  const innings = (M.current?.innings ?? 1) as 1 | 2;
  const target = M.rows.find(r => r.innings === innings)?.target ?? null;
  const S = useScoring(matchId, innings, format, target ?? undefined);

  // Only asked for when the app has nothing — no point paying for a CricHeroes
  // fetch on a match we're scoring ourselves.
  const appHasBalls = S.balls.length > 0;
  const ch = useLiveScore(appHasBalls ? null : chMatchId ?? null);

  const view = useMemo<LiveView | null>(() => {
    if (appHasBalls && M.current) {
      return {
        battingTeam: M.current.batting_team,
        bowlingTeam: M.current.bowling_team,
        runs: S.state.runs,
        wickets: S.state.wickets,
        legalBalls: legalCount(S.balls),
        target,
        balls: S.balls,
        source: 'app',
      };
    }

    // CricHeroes gives running totals, not deliveries. Rather than synthesise a
    // ball feed from a total — which would read like commentary while being
    // invented — we hand over an empty ball list and the viewer says so.
    const d = ch.data;
    if (!d) return null;

    // Its score and overs arrive as display strings ("120/3", "12.3"), so they
    // have to be parsed back into numbers the win-probability model can use.
    const [runsStr, wktsStr] = (d.score ?? '').split('/');
    const [oStr, bStr] = (d.overs ?? '0.0').split('.');
    const runs = Number(runsStr) || 0;
    const wickets = Number(wktsStr) || 0;
    const legalBalls = (Number(oStr) || 0) * 6 + (Number(bStr) || 0);

    // Only the chase has a target, and CricHeroes reports it as a required rate
    // rather than a number, so it's reconstructed from what's left to bowl.
    const rrr = Number(d.requiredRunRate);
    const ballsLeft = format.oversPerInnings * 6 - legalBalls;
    const chTarget = !d.battingFirst && Number.isFinite(rrr) && rrr > 0 && ballsLeft > 0
      ? runs + Math.ceil((rrr / 6) * ballsLeft)
      : null;

    return {
      battingTeam: d.battingTeam || sides.home,
      bowlingTeam: d.bowlingTeam || sides.away,
      runs, wickets, legalBalls, target: chTarget,
      balls: [],
      source: 'cricheroes',
    };
  }, [appHasBalls, M.current, S.state, S.balls, target, ch.data, sides, format]);

  return { view, loading: M.loading || ch.loading, innings };
}
