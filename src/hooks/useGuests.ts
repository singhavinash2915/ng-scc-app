import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ─── Guest players ────────────────────────────────────────────────────────────
// A friend filling in when the club is a player short. They pay the same match
// fee as everyone else, and that is the only thing about them the app tracks:
// no wallet, no season fund, no leaderboard, no stats. Their scorecard names
// land in the CricHeroes sync's unmatched list and are ignored there once.
//
// Kept in their own tables rather than as members with a 'guest' status, so no
// club figure can pick them up by forgetting to filter.

export interface Guest {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
}

export interface MatchGuest {
  id: string;
  match_id: string;
  guest_id: string;
  fee_amount: number;
  fee_paid: boolean;
  invited_by: string | null;
  notes: string | null;
  guest?: Guest;
}

const isMissing = (e: { code?: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205');

export function useGuests(matchId?: string | null) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [appearances, setAppearances] = useState<MatchGuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const refresh = useCallback(async () => {
    const [{ data: gs, error: gErr }, { data: mg }] = await Promise.all([
      supabase.from('guests').select('id, name, phone, notes').order('name'),
      matchId
        ? supabase.from('match_guests')
            .select('id, match_id, guest_id, fee_amount, fee_paid, invited_by, notes, guest:guests(id, name, phone, notes)')
            .eq('match_id', matchId)
        : Promise.resolve({ data: [] as MatchGuest[] }),
    ]);

    if (isMissing(gErr)) { setMissing(true); setLoading(false); return; }
    setMissing(false);
    setGuests((gs ?? []) as Guest[]);
    setAppearances(((mg ?? []) as MatchGuest[]).map(a => ({ ...a, fee_amount: Number(a.fee_amount) })));
    setLoading(false);
  }, [matchId]);

  useEffect(() => { void refresh(); }, [refresh]);

  /** Find an existing guest by name, or create one. Matching is case-insensitive
   *  so "Rohit" and "rohit" don't become two people over a season. */
  const findOrCreateGuest = useCallback(async (name: string, phone?: string) => {
    const clean = name.trim();
    if (!clean) return { error: 'Enter a name.' as string, guest: null };

    const existing = guests.find(g => g.name.trim().toLowerCase() === clean.toLowerCase());
    if (existing) return { error: null, guest: existing };

    const { data, error } = await supabase
      .from('guests')
      .insert({ name: clean, phone: phone?.trim() || null })
      .select('id, name, phone, notes')
      .single();
    if (error) return { error: error.message, guest: null };
    await refresh();
    return { error: null, guest: data as Guest };
  }, [guests, refresh]);

  /** Add a guest to a match at the match's own fee. */
  const addToMatch = useCallback(async (
    guestId: string, forMatch: string, feeAmount: number, invitedBy?: string | null,
  ) => {
    const { error } = await supabase.from('match_guests').insert({
      match_id: forMatch, guest_id: guestId,
      fee_amount: feeAmount, invited_by: invitedBy ?? null,
    });
    if (error) return error.message;
    await refresh();
    return null;
  }, [refresh]);

  const removeFromMatch = useCallback(async (appearanceId: string) => {
    const { error } = await supabase.from('match_guests').delete().eq('id', appearanceId);
    if (error) return error.message;
    await refresh();
    return null;
  }, [refresh]);

  /**
   * A guest pays cash on the day. That is club income, but it is nobody's wallet
   * credit — so it posts as a transaction with no member attached, the same
   * shape as opponent booking money. Marking it unpaid removes the transaction
   * again, so the ledger always matches the toggle.
   */
  const setFeePaid = useCallback(async (a: MatchGuest, paid: boolean, guestName: string, matchDate: string) => {
    const { error } = await supabase.from('match_guests')
      .update({ fee_paid: paid }).eq('id', a.id);
    if (error) return error.message;

    const description = `Guest fee — ${guestName} · ${matchDate}`;
    if (paid && a.fee_amount > 0) {
      await supabase.from('transactions').insert({
        date: matchDate, type: 'deposit', amount: a.fee_amount,
        member_id: null, match_id: a.match_id, description,
      });
    } else {
      await supabase.from('transactions').delete()
        .eq('match_id', a.match_id).eq('description', description).is('member_id', null);
    }
    await refresh();
    return null;
  }, [refresh]);

  return {
    guests, appearances, loading, missing,
    findOrCreateGuest, addToMatch, removeFromMatch, setFeePaid, refresh,
  };
}
