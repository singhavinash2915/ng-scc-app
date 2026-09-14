import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { computeMatchImpact, type MatchImpact, type StoredBall, type FieldEvent } from '../lib/matchImpact';
import { isOppositionId, oppositionLabel } from '../lib/opposition';
import { internalSides } from '../utils/internalTeams';
import { DEFAULT_FORMAT } from '../lib/cricketRules';

// ─── Impact for one match ─────────────────────────────────────────────────────
// Looked up by the CricHeroes id because that is what Match Centre is opened
// with. Returns null impact — not an error — for matches without app-scored
// deliveries, so the tab can say why instead of showing zeros.

const missing = (e: { code?: string } | null) =>
  !!e && ['42P01', 'PGRST205', 'PGRST116'].includes(e.code ?? '');

export interface MatchImpactResult {
  impact: MatchImpact | null;
  sideName: (key: string) => string;
  playerName: (id: string) => string;
  loading: boolean;
  /** True when the table for dropped catches exists — the pad buttons need it. */
}

export function useMatchImpact(chMatchId: string | null, enabled: boolean): MatchImpactResult {
  const [impact, setImpact] = useState<MatchImpact | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [sides, setSides] = useState<{ home: string; away: string; opp: string }>({ home: 'Sangria CC', away: 'Opponent', opp: 'Opponent' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !chMatchId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: match } = await supabase.from('matches')
        .select('id, opponent, match_type, overs_per_innings, players_per_side')
        .eq('ch_match_id', chMatchId).limit(1).maybeSingle();
      if (!match) { if (!cancelled) { setImpact(null); setLoading(false); } return; }

      const [inn, balls, events, members, guests] = await Promise.all([
        supabase.from('scc_innings').select('innings, batting_team, target').eq('match_id', match.id),
        supabase.from('scc_ball_by_ball').select('*').eq('match_id', match.id).order('seq').limit(2000),
        supabase.from('scc_field_events').select('innings, seq, kind, fielder_id, runs').eq('match_id', match.id),
        supabase.from('members').select('id, name'),
        supabase.from('match_guests').select('guest_id, guest:guests(name)').eq('match_id', match.id),
      ]);
      if (cancelled) return;

      const nm: Record<string, string> = {};
      for (const m of members.data ?? []) nm[m.id] = m.name;
      for (const g of (guests.data ?? []) as Array<{ guest_id: string; guest: { name: string } | { name: string }[] | null }>) {
        const gg = Array.isArray(g.guest) ? g.guest[0] : g.guest;
        nm[g.guest_id] = `${gg?.name ?? 'Guest'} (guest)`;
      }
      setNames(nm);

      const isInternal = match.match_type === 'internal';
      const s2 = internalSides(match);
      setSides(isInternal
        ? { home: s2.home, away: s2.away, opp: s2.away }
        : { home: 'Sangria CC', away: match.opponent || 'Opponent', opp: match.opponent || 'Opponent' });

      if (!balls.data?.length || !inn.data?.length) { setImpact(null); setLoading(false); return; }
      const fmt = {
        oversPerInnings: match.overs_per_innings ?? DEFAULT_FORMAT.oversPerInnings,
        playersPerSide: match.players_per_side ?? DEFAULT_FORMAT.playersPerSide,
      };
      const ev = missing(events.error) ? [] : (events.data ?? []) as FieldEvent[];
      setImpact(computeMatchImpact(inn.data, balls.data as StoredBall[], fmt, ev));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [chMatchId, enabled]);

  return {
    impact, loading,
    sideName: (k: string) => (k === 'home' ? sides.home : sides.away),
    playerName: (id: string) => isOppositionId(id) ? oppositionLabel(id, sides.opp) : (names[id] ?? 'Unknown'),
  };
}
