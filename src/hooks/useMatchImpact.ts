import { useEffect, useState } from 'react';
import { loadMatchBalls, type MatchBalls } from '../lib/matchBalls';
import { computeMatchImpact, type MatchImpact } from '../lib/matchImpact';

// ─── Impact for one match ─────────────────────────────────────────────────────
// Looked up by the CricHeroes id because that is what Match Centre is opened
// with. Balls come from the pad when the match was scored there, otherwise from
// the CricHeroes rebuild — see lib/matchBalls. Null impact, not an error, when
// neither has the match, so the tab can say why.

export interface MatchImpactResult {
  impact: MatchImpact | null;
  source: MatchBalls['source'] | null;
  quality: MatchBalls['quality'] | null;
  sideName: (key: string) => string;
  playerName: (id: string) => string;
  /** True for players who appeared for SCC. */
  isClub: (id: string) => boolean;
  loading: boolean;
}

export function useMatchImpact(chMatchId: string | null, enabled: boolean): MatchImpactResult {
  const [data, setData] = useState<{ mb: MatchBalls; impact: MatchImpact } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !chMatchId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const mb = await loadMatchBalls(chMatchId).catch(() => null);
      if (cancelled) return;
      setData(mb ? { mb, impact: computeMatchImpact(mb.rows, mb.balls, mb.fmt, mb.events) } : null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [chMatchId, enabled]);

  const mb = data?.mb;
  return {
    impact: data?.impact ?? null,
    source: mb?.source ?? null,
    quality: mb?.quality ?? null,
    loading,
    sideName: k => mb?.sideName(k) ?? k,
    playerName: id => mb?.name(id) ?? 'Unknown',
    isClub: id => !!mb && mb.isClubSide(data!.impact.sideOf[id] ?? ''),
  };
}
