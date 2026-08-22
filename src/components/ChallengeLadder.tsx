import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Flame, Trophy } from 'lucide-react';
import { buildLadder } from '../lib/challengeLadder';
import { useMe } from '../context/MemberContext';
import type { ChallengeRow } from '../hooks/useChallenges';
import type { Member } from '../types';

// ─── Season ladder ────────────────────────────────────────────────────────────
// Challenges were the most-opened thing in the app within days of launching,
// and they had no memory: every one started from nothing and vanished when it
// settled. This is the thread between them.
//
// Deliberately not a points system. Wins and a streak are legible at a glance
// and can't be argued with; a weighted score invites "why is he above me" and
// needs explaining every season.

interface Props {
  rows: ChallengeRow[];
  members: Member[];
}

/** Written out — Tailwind never compiles an interpolated class name. */
const MEDAL = ['text-amber-500', 'text-slate-400', 'text-orange-600'];

export function ChallengeLadder({ rows, members }: Props) {
  const { me } = useMe();
  const ladder = useMemo(() => buildLadder(rows), [rows]);
  const byId = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);

  // Before anything has settled the table would be a row of zeroes, which
  // reads as broken rather than empty. Say what fills it instead.
  if (!ladder.length) {
    const live = rows.filter(r => r.status === 'live' || r.status === 'open').length;
    return (
      <div className="r-card border border-slate-200 dark:border-white/10 p-4">
        <p className="t-micro font-black uppercase tracking-[1.5px] text-slate-400">
          Season ladder
        </p>
        <p className="t-body text-slate-500 dark:text-white/50 mt-1">
          {live > 0
            ? `${live} challenge${live > 1 ? 's' : ''} running. The ladder fills in as they settle — wins and streaks carry across the whole season.`
            : 'Win a challenge and you land on the ladder. Wins and streaks carry across the whole season.'}
        </p>
      </div>
    );
  }

  return (
    <div className="r-card border border-slate-200 dark:border-white/10 overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <p className="t-micro font-black uppercase tracking-[1.5px] text-slate-400">
          Season ladder
        </p>
        <p className="t-micro font-bold text-slate-400">Won · Played</p>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-white/10">
        {ladder.map((r, i) => {
          const m = byId.get(r.memberId);
          const isMe = r.memberId === me?.id;
          return (
            <Link key={r.memberId} to={`/profile/${r.memberId}`}
              className={`flex items-center gap-3 px-4 py-2.5 ${
                isMe ? 'bg-emerald-50/70 dark:bg-emerald-500/10' : ''}`}>
              <span className={`t-num text-sm w-5 text-center shrink-0 ${
                i < 3 ? MEDAL[i] : 'text-slate-300 dark:text-white/30'}`}>
                {i + 1}
              </span>

              {m?.avatar_url
                ? <img src={m.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                : (
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 shrink-0
                                  flex items-center justify-center t-micro font-black text-slate-500">
                    {(m?.name ?? '?').slice(0, 1)}
                  </div>
                )}

              <p className="flex-1 min-w-0 font-bold t-body text-slate-900 dark:text-white truncate">
                {m?.name ?? 'Unknown'}
                {isMe && <span className="text-emerald-600 dark:text-emerald-400"> · you</span>}
              </p>

              {/* A streak is the number people actually chase, so it gets the
                  colour. Shown from two — calling a single win a streak is the
                  kind of inflation that makes a stat stop meaning anything. */}
              {r.streak > 1 && (
                <span className="inline-flex items-center gap-0.5 t-micro font-black px-1.5 py-0.5
                                 rounded-full bg-orange-100 text-orange-700
                                 dark:bg-orange-400/20 dark:text-orange-300 shrink-0">
                  <Flame className="w-3 h-3" />{r.streak}
                </span>
              )}

              <p className="t-num text-sm text-slate-900 dark:text-white shrink-0 tabular-nums">
                {r.won}<span className="text-slate-300 dark:text-white/30"> · {r.played}</span>
              </p>
            </Link>
          );
        })}
      </div>

      {ladder[0] && ladder[0].won > 0 && (
        <p className="t-micro text-slate-400 px-4 py-2 border-t border-slate-100 dark:border-white/10
                      inline-flex items-center gap-1.5">
          <Trophy className="w-3 h-3 text-amber-500" />
          {byId.get(ladder[0].memberId)?.name.split(' ')[0]} leads the season
        </p>
      )}
    </div>
  );
}
