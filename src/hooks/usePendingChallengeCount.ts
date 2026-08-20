import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useMe } from '../context/MemberContext';

// ─── Pending challenge count ──────────────────────────────────────────────────
// A badge is the only thing that makes a challenge visible without opening the
// page. Counts head-only — no rows fetched — so putting it in the nav costs
// nothing on every render.

export function usePendingChallengeCount(): number {
  const { me } = useMe();
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!me) { setN(0); return; }
    void (async () => {
      const { count, error } = await supabase
        .from('scc_challenge_players')
        .select('challenge_id', { count: 'exact', head: true })
        .eq('member_id', me.id).eq('accepted', false);
      if (!error) setN(count ?? 0);
    })();
  }, [me]);

  return n;
}
