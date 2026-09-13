import { useMemo } from 'react';
import type { Match, Member } from '../types';

// ─── Who has led SCC, and how it went ─────────────────────────────────────────
// The club records a captain on the fixture, and has done since 27 April 2026.
// Everything here is computed from that — no new table, no sync, nothing to
// maintain: name a captain when you schedule a match and this page fills in.
//
// The honest limit is the sample. Captaincy has been recorded for a couple of
// dozen matches, and nobody has led more than ten. Every figure below is real,
// and none of it is a verdict on anybody — which is why the page says so rather
// than ranking people by win rate and leaving it at that.

export interface CaptainRecord {
  memberId: string;
  member: Member | undefined;
  led: number;
  won: number;
  lost: number;
  drawn: number;
  /** Won as a share of decided matches — draws and no-results excluded. */
  winPct: number;
  /** Runs scored and conceded, averaged over the matches with a score on file. */
  avgFor: number | null;
  avgAgainst: number | null;
  /** Their biggest win and heaviest defeat, by runs. */
  best: { margin: number; opponent: string; date: string } | null;
  worst: { margin: number; opponent: string; date: string } | null;
  /** Man of the Match awards won while leading the side. */
  momWhileLeading: number;
  firstLed: string;
  lastLed: string;
  /** Who they most often had alongside them. */
  usualDeputy: { member: Member | undefined; count: number } | null;
  /** Newest first — the form strip. */
  form: Array<{ result: Match['result']; date: string; opponent: string | null }>;
}

export interface CaptaincyData {
  captains: CaptainRecord[];
  /** Matches played with a captain on file, and the club's record in them. */
  ledTotal: number;
  ledWon: number;
  ledLost: number;
  /** Matches played before anybody recorded one — the blind spot, stated. */
  unrecorded: number;
  since: string | null;
  /** Every captained match, newest first, for the timeline. */
  timeline: Array<{ match: Match; captain: Member | undefined }>;
}

/** "112/7 (15.0 Ov)" → 112. */
function scoreRuns(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = /\s*(\d+)/.exec(s);
  return m ? Number(m[1]) : null;
}

const PLAYED = ['won', 'lost', 'draw'];

export function useCaptaincy(matches: Match[], members: Member[]): CaptaincyData {
  return useMemo(() => {
    const byId = new Map(members.map(m => [m.id, m]));
    const played = matches.filter(m => PLAYED.includes(m.result));
    const led = played.filter(m => m.captain_id);

    const groups = new Map<string, Match[]>();
    for (const m of led) {
      const list = groups.get(m.captain_id!) ?? [];
      list.push(m);
      groups.set(m.captain_id!, list);
    }

    const captains: CaptainRecord[] = [...groups.entries()].map(([memberId, own]) => {
      const byDate = [...own].sort((a, b) => a.date.localeCompare(b.date));
      const won = own.filter(m => m.result === 'won').length;
      const lost = own.filter(m => m.result === 'lost').length;
      const drawn = own.filter(m => m.result === 'draw').length;
      const decided = won + lost;

      const fors: number[] = [];
      const againsts: number[] = [];
      const margins: Array<{ margin: number; opponent: string; date: string }> = [];
      for (const m of own) {
        const f = scoreRuns(m.our_score);
        const a = scoreRuns(m.opponent_score);
        if (f != null) fors.push(f);
        if (a != null) againsts.push(a);
        if (f != null && a != null) {
          margins.push({ margin: f - a, opponent: m.opponent || 'Unknown', date: m.date });
        }
      }
      const mean = (xs: number[]) => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;

      // Who stood alongside them most often.
      const deputies = new Map<string, number>();
      for (const m of own) {
        if (!m.vice_captain_id) continue;
        deputies.set(m.vice_captain_id, (deputies.get(m.vice_captain_id) ?? 0) + 1);
      }
      const topDeputy = [...deputies.entries()].sort((a, b) => b[1] - a[1])[0];

      return {
        memberId,
        member: byId.get(memberId),
        led: own.length,
        won, lost, drawn,
        winPct: decided ? Math.round((won / decided) * 100) : 0,
        avgFor: mean(fors),
        avgAgainst: mean(againsts),
        best: margins.length ? margins.reduce((b, x) => (x.margin > b.margin ? x : b)) : null,
        worst: margins.length ? margins.reduce((b, x) => (x.margin < b.margin ? x : b)) : null,
        momWhileLeading: own.filter(m => m.man_of_match_id === memberId).length,
        firstLed: byDate[0].date,
        lastLed: byDate[byDate.length - 1].date,
        usualDeputy: topDeputy
          ? { member: byId.get(topDeputy[0]), count: topDeputy[1] }
          : null,
        form: [...byDate].reverse().slice(0, 8)
          .map(m => ({ result: m.result, date: m.date, opponent: m.opponent })),
      };
    })
      // Most matches led first: experience, not win rate, which over six
      // matches says more about the opposition than the captain.
      .sort((a, b) => b.led - a.led || b.winPct - a.winPct);

    const timeline = [...led]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(m => ({ match: m, captain: byId.get(m.captain_id!) }));

    return {
      captains,
      ledTotal: led.length,
      ledWon: led.filter(m => m.result === 'won').length,
      ledLost: led.filter(m => m.result === 'lost').length,
      unrecorded: played.length - led.length,
      since: led.length ? [...led].sort((a, b) => a.date.localeCompare(b.date))[0].date : null,
      timeline,
    };
  }, [matches, members]);
}
