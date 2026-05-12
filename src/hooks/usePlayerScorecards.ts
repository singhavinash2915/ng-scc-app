import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { BatterRow, BowlerRow } from './useMatchScorecard';

export interface PlayerKnock extends BatterRow {
  date: string;
  opponent: string;
}
export interface PlayerSpell extends BowlerRow {
  date: string;
  opponent: string;
}

interface CardRow {
  match_id: string;
  innings1_team_id: number | null;
  innings1_batting: BatterRow[] | null;
  innings1_bowling: BowlerRow[] | null;
  innings2_team_id: number | null;
  innings2_batting: BatterRow[] | null;
  innings2_bowling: BowlerRow[] | null;
  match: { date: string; opponent: string | null } | null;
}

// SCC team_id on CricHeroes — used to identify SCC's innings vs opponent's
const SCC_TEAM_ID = 7927431;

// Normalize a name for fuzzy matching
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

function namesMatch(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // First-name fallback
  const firstA = a.toLowerCase().split(/\s+/)[0];
  const firstB = b.toLowerCase().split(/\s+/)[0];
  if (firstA && firstA === firstB) return true;
  // One contains the other
  return na.includes(nb) || nb.includes(na);
}

/**
 * For a given SCC member name, returns every batting innings + bowling spell
 * across the season's scorecards. Used by the personal stats dashboard +
 * achievements engine.
 *
 * Only pulls SCC's own innings (where innings_team_id === 7927431 for batting,
 * opposite for bowling).
 */
export function usePlayerScorecards(memberName: string | undefined) {
  const [cards, setCards] = useState<CardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('match_scorecards')
        .select(`
          match_id,
          innings1_team_id, innings1_batting, innings1_bowling,
          innings2_team_id, innings2_batting, innings2_bowling,
          match:matches(date, opponent)
        `)
        .order('match(date)', { ascending: false });

      if (cancelled) return;
      setCards((data as unknown as CardRow[]) || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const { knocks, spells } = useMemo(() => {
    if (!memberName) return { knocks: [] as PlayerKnock[], spells: [] as PlayerSpell[] };

    const knocks: PlayerKnock[] = [];
    const spells: PlayerSpell[] = [];

    for (const c of cards) {
      if (!c.match) continue;
      const date = c.match.date;
      const opponent = c.match.opponent || '—';

      // SCC's batting innings → look for member among batters
      const sccBatting = c.innings1_team_id === SCC_TEAM_ID
        ? c.innings1_batting
        : c.innings2_team_id === SCC_TEAM_ID
          ? c.innings2_batting
          : null;

      // SCC's bowling → opponent's batting innings → SCC bowled there
      const sccBowling = c.innings1_team_id === SCC_TEAM_ID
        ? c.innings2_bowling
        : c.innings2_team_id === SCC_TEAM_ID
          ? c.innings1_bowling
          : null;

      if (sccBatting) {
        for (const b of sccBatting) {
          if (namesMatch(b.name, memberName)) {
            knocks.push({ ...b, date, opponent });
          }
        }
      }
      if (sccBowling) {
        for (const bw of sccBowling) {
          if (namesMatch(bw.name, memberName)) {
            spells.push({ ...bw, date, opponent });
          }
        }
      }
    }

    return { knocks, spells };
  }, [cards, memberName]);

  // Sorted variants for convenience
  const topKnocks = useMemo(() =>
    [...knocks].sort((a, b) => b.runs - a.runs).slice(0, 5)
  , [knocks]);

  const topSpells = useMemo(() =>
    [...spells].sort((a, b) => {
      if (b.wickets !== a.wickets) return b.wickets - a.wickets;
      return a.runs - b.runs;
    }).slice(0, 5)
  , [spells]);

  return { knocks, spells, topKnocks, topSpells, loading };
}
