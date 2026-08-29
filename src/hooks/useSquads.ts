import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Member } from '../types';

// ─── The two MahaSangram squads, as they were auctioned ───────────────────────
// Read-only. `useAuctionLive` owns the same tables but carries the bidding
// machinery — realtime subscriptions, bid state, undo — none of which a screen
// that only wants to know who captains Agni should be paying for.
//
// The captain ids live on the auction row, not on members, which is why the
// AI chat could describe MahaSangram in detail and still not name a captain:
// nothing it was given contained one.

export interface SquadPlayer {
  member_id: string;
  name: string;
  /** ₹ lakh, as bid. null for a retained captain, who was never bid for. */
  price: number | null;
  isCaptain: boolean;
}

export interface Squad {
  key: 'team1' | 'team2';
  name: string;
  captain: string | null;
  players: SquadPlayer[];
  spent: number;
  purse: number;
}

export function useSquads(members: Member[], season = '2026-27') {
  const [auction, setAuction] = useState<{
    team1_name: string; team2_name: string;
    team1_captain_id: string | null; team2_captain_id: string | null;
    purse_lakh: number; squad_size: number; status: string;
  } | null>(null);
  const [picks, setPicks] = useState<Array<{ member_id: string; team: string; price: number }>>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const [a, p] = await Promise.all([
      supabase.from('scc_auction')
        .select('team1_name, team2_name, team1_captain_id, team2_captain_id, purse_lakh, squad_size, status')
        .eq('season', season).maybeSingle(),
      supabase.from('scc_auction_picks')
        .select('member_id, team, price').eq('season', season),
    ]);
    setAuction(a.error ? null : (a.data as typeof auction));
    setPicks(p.error ? [] : (p.data ?? []));
    setLoading(false);
  }, [season]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const squads = useMemo<Squad[]>(() => {
    if (!auction) return [];
    const nameOf = (id: string) => members.find(m => m.id === id)?.name ?? 'Unknown';
    const build = (key: 'team1' | 'team2', label: string, captainId: string | null): Squad => {
      const mine = picks.filter(p => p.team === key);
      const players: SquadPlayer[] = mine.map(p => ({
        member_id: p.member_id, name: nameOf(p.member_id),
        price: p.price, isCaptain: p.member_id === captainId,
      }));
      // A captain who was retained rather than bid for has no pick row, so add
      // them explicitly — otherwise the squad reads as one player short and the
      // captain is missing from the very list they lead.
      //
      // price is null, not 0: a retained captain was never bid for, and zero
      // reads as "went for nothing". The AI chat said exactly that out loud.
      if (captainId && !players.some(x => x.member_id === captainId)) {
        players.unshift({ member_id: captainId, name: nameOf(captainId), price: null, isCaptain: true });
      }
      return {
        key, name: label, captain: captainId ? nameOf(captainId) : null,
        players: players.sort((a, b) => Number(b.isCaptain) - Number(a.isCaptain) || (b.price ?? 0) - (a.price ?? 0)),
        spent: mine.reduce((s, p) => s + (p.price || 0), 0),
        purse: auction.purse_lakh,
      };
    };
    return [
      build('team1', auction.team1_name, auction.team1_captain_id),
      build('team2', auction.team2_name, auction.team2_captain_id),
    ];
  }, [auction, picks, members]);

  return { squads, auction, loading, refetch: fetchAll };
}
