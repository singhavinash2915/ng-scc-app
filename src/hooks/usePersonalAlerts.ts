import { useMemo } from 'react';
import { useMe } from '../context/MemberContext';
import type { Match } from '../types';

// ─── Notifications that mean something ────────────────────────────────────────
// Push already existed but said the same thing to all 46 members, which is how
// a club app trains people to mute it. Four notifications someone actually wants
// beat twenty they swipe away.
//
// Everything here is DERIVED from data the app already holds — no new table, no
// job to run, nothing to go stale. An alert exists exactly as long as the thing
// it describes is true, so there's no "mark as read" to maintain and no risk of
// telling someone they're picked for a match that already happened.

export type AlertTone = 'urgent' | 'info' | 'good';

export interface Alert {
  id: string;
  tone: AlertTone;
  title: string;
  body: string;
  to: string;
}

const daysUntil = (iso: string) =>
  Math.ceil((new Date(iso + 'T00:00:00').getTime() - Date.now()) / 86400000);

export function usePersonalAlerts(matches: Match[]) {
  const { me } = useMe();

  return useMemo<Alert[]>(() => {
    if (!me) return [];
    const out: Alert[] = [];
    const upcoming = matches
      .filter(m => m.result === 'upcoming')
      .sort((a, b) => a.date.localeCompare(b.date));
    const next = upcoming[0];

    // ── You're picked ──────────────────────────────────────────────────────
    // Only worth saying close to the match. A fortnight out it's news; the
    // morning of, it's the single most useful thing the app can tell you.
    if (next) {
      const d = daysUntil(next.date);
      const picked = next.players?.some(p => p.member_id === me.id);
      if (picked && d >= 0 && d <= 3) {
        out.push({
          id: `picked-${next.id}`,
          tone: d === 0 ? 'urgent' : 'good',
          title: d === 0 ? "You're playing today" : `You're picked — ${d === 1 ? 'tomorrow' : `in ${d} days`}`,
          body: `${next.opponent || 'SCC'}${next.venue ? ` at ${next.venue}` : ''}`,
          to: '/matches',
        });
      }

      // ── Squad poll still open ────────────────────────────────────────────
      // Nagging someone who has already answered is the fastest way to lose
      // them, so this only fires when there's genuinely no response on file.
      const answered = next.polls?.some(p => p.member_id === me.id);
      if (next.polling_enabled && !answered && d >= 0) {
        out.push({
          id: `poll-${next.id}`,
          tone: d <= 1 ? 'urgent' : 'info',
          title: 'Are you available?',
          body: `The squad for ${next.opponent || 'the next match'} is being picked.`,
          to: `/poll/${next.id}`,
        });
      }
    }

    // ── Your balance ───────────────────────────────────────────────────────
    // Tied to there being a match to pay for. A low balance in the off-season
    // is not urgent, and saying so anyway is what makes people stop looking.
    if (me.balance < 500 && next && daysUntil(next.date) <= 7) {
      out.push({
        id: 'balance',
        tone: me.balance < 200 ? 'urgent' : 'info',
        title: `Balance is ₹${Math.round(me.balance)}`,
        body: 'Top up before the next match so the fee clears.',
        to: '/payment',
      });
    }

    // ── Your birthday ──────────────────────────────────────────────────────
    if (me.birthday) {
      const b = new Date(me.birthday);
      const now = new Date();
      if (b.getDate() === now.getDate() && b.getMonth() === now.getMonth()) {
        out.push({
          id: 'birthday', tone: 'good',
          title: 'Happy birthday! 🎂',
          body: 'From everyone at Sangria CC.',
          to: `/profile/${me.id}`,
        });
      }
    }

    const rank: Record<AlertTone, number> = { urgent: 0, good: 1, info: 2 };
    return out.sort((a, b) => rank[a.tone] - rank[b.tone]);
  }, [me, matches]);
}
