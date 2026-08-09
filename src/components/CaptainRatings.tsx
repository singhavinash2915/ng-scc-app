import { useMemo, useState } from 'react';
import { Star, Lock } from 'lucide-react';
import { usePlayerRatings } from '../hooks/usePlayerRatings';
import type { Match, Member } from '../types';

// ─── Captain post-match ratings ────────────────────────────────────────────────
// Captains score their own side out of 10. Two things shape this component more
// than anything else:
//
//   1. RLS on this schema is public — every row is readable by anyone with the
//      app. So the component never renders another player's mark. You see your
//      own, and everyone sees squad averages. Nobody opens the app to find
//      themselves on 4/10 in a list beside their team-mates.
//   2. Rating twenty-four players is a chore, so it's one tap per player with a
//      1–10 row, no modal, no save button — it upserts as you go.

interface Props {
  match: Match;
  members: Member[];
  myMemberId: string | null;
  /** Captains and admins get the editor; everyone else sees their own mark. */
  canRate: boolean;
}

const SCALE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const toneFor = (n: number) =>
  n >= 8 ? 'bg-emerald-500' : n >= 6 ? 'bg-sky-500' : n >= 4 ? 'bg-amber-500' : 'bg-rose-500';

export function CaptainRatings({ match, members, myMemberId, canRate }: Props) {
  const { ratings, ratingFor, rate, tableMissing } = usePlayerRatings(match.id);
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  /** Who played — the only people worth rating. */
  const squad = useMemo(() => {
    const played = (match.players ?? []).map(p => p.member_id);
    return members
      .filter(m => played.includes(m.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [match.players, members]);

  const myRating = myMemberId ? ratingFor(myMemberId) : null;

  const teamAverage = useMemo(() => {
    if (ratings.length === 0) return null;
    return Math.round((ratings.reduce((n, r) => n + r.rating, 0) / ratings.length) * 10) / 10;
  }, [ratings]);

  if (tableMissing || match.result === 'upcoming' || match.result === 'cancelled') return null;
  if (!canRate && myRating === null && teamAverage === null) return null;

  const setRating = async (memberId: string, value: number) => {
    setBusy(memberId);
    const err = await rate(match.id, memberId, value, myMemberId);
    setBusy(null);
    if (err) alert(err);
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/5 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
          <Star className="w-3.5 h-3.5" /> Captain's ratings
        </span>
        {teamAverage !== null && (
          <span className="text-[10px] font-bold text-slate-400">
            squad avg {teamAverage} · {ratings.length} rated
          </span>
        )}
      </div>

      {/* What a player sees about themselves — never about anyone else. */}
      {!canRate && (
        <div className="mt-2.5">
          {myRating !== null ? (
            <div className="flex items-center gap-2.5">
              <span className={`w-9 h-9 rounded-xl text-white font-black text-sm
                                flex items-center justify-center ${toneFor(myRating)}`}>
                {myRating}
              </span>
              <span className="text-[12px] text-slate-600 dark:text-white/70">
                Your rating for this match
              </span>
            </div>
          ) : (
            <p className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
              <Lock className="w-3 h-3" /> Ratings are private — you'll only ever see your own.
            </p>
          )}
        </div>
      )}

      {/* The editor, captains and admins only. */}
      {canRate && (
        <div className="mt-3">
          {!expanded ? (
            <button onClick={() => setExpanded(true)}
              className="w-full rounded-xl border-2 border-violet-200 dark:border-violet-400/30
                         text-violet-600 dark:text-violet-300 font-black text-[12px] py-2.5">
              {ratings.length > 0 ? 'Edit ratings' : `Rate the squad (${squad.length})`}
            </button>
          ) : (
            <div className="space-y-2">
              {squad.length === 0 && (
                <p className="text-[11px] text-slate-400">
                  No squad recorded for this match, so there's nobody to rate.
                </p>
              )}
              {squad.map(m => {
                const val = ratingFor(m.id);
                return (
                  <div key={m.id} className="flex items-center gap-2">
                    <span className="w-24 sm:w-32 shrink-0 truncate text-[12px] font-bold
                                     text-slate-800 dark:text-white/85">
                      {m.name}
                    </span>
                    <div className="flex gap-0.5 flex-1 min-w-0">
                      {SCALE.map(n => (
                        <button key={n} onClick={() => setRating(m.id, n)}
                          disabled={busy === m.id}
                          className={`flex-1 min-w-0 h-7 rounded text-[10px] font-black transition-colors
                            ${val === n
                              ? `${toneFor(n)} text-white`
                              : 'bg-slate-100 dark:bg-white/10 text-slate-400 hover:bg-slate-200'}
                            disabled:opacity-40`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              <button onClick={() => setExpanded(false)}
                className="w-full text-[11px] font-bold text-slate-400 pt-1">Done</button>
              <p className="text-[10px] text-slate-400 leading-snug">
                Saved as you tap. Players only ever see their own mark and the squad average —
                but these rows are readable by anyone with the app, so write them as if they might
                be read.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
