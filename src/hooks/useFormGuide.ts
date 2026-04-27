import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export type FormResult = 'won' | 'lost' | 'draw';

/**
 * For each member, returns the result of the last N matches they played in.
 * Only counts completed external matches (won/lost/draw, not internal).
 *
 * Example: { 'member-uuid': ['won', 'won', 'lost', 'won', 'draw'] }
 *           — newest first
 */
export function useFormGuide(seasonStart = '2025-09-01', limit = 5) {
  const [formByMember, setFormByMember] = useState<Record<string, FormResult[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      // Fetch every match_player row for completed external matches in this season,
      // ordered by date desc. Then group in JS.
      const { data, error } = await supabase
        .from('match_players')
        .select(`
          member_id,
          match:matches!inner(date, result, match_type)
        `)
        .gte('match.date', seasonStart)
        .in('match.result', ['won', 'lost', 'draw'])
        .eq('match.match_type', 'external')
        .order('date', { foreignTable: 'matches', ascending: false });

      if (cancelled) return;
      if (error || !data) {
        setFormByMember({});
        setLoading(false);
        return;
      }

      const tally: Record<string, FormResult[]> = {};
      type Row = { member_id: string; match: { date: string; result: string; match_type: string } | null };
      for (const row of (data as unknown as Row[])) {
        if (!row.match) continue;
        const r = row.match.result as FormResult;
        if (!['won', 'lost', 'draw'].includes(r)) continue;
        if (!tally[row.member_id]) tally[row.member_id] = [];
        if (tally[row.member_id].length < limit) tally[row.member_id].push(r);
      }

      setFormByMember(tally);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [seasonStart, limit]);

  return { formByMember, loading };
}
