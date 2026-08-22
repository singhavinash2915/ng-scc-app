import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { MapPin, Navigation, Swords, ChevronRight } from 'lucide-react';
import { useMe } from '../context/MemberContext';
import { useChallenges } from '../hooks/useChallenges';
import type { Match, Member } from '../types';

// ─── Match day ────────────────────────────────────────────────────────────────
// Usage said two things at once: the home screen and the challenges board are
// where members actually go (82 and 66 sessions in four days), and the pages
// built to be browsed — leaderboard, honours, insights — are not (9 between
// them). The lesson isn't that those pages are bad. It's that nobody navigates
// to anything; they open the app and read what's in front of them.
//
// So this doesn't add a page. On the one day everyone opens the app, it puts
// the match at the top and pulls the useful parts of the club — where to go,
// who's playing, what's riding on it — into the first screen.
//
// The old version of this was a single line of text sitting fifteenth on the
// Dashboard, below the birthdays. It was correct and nobody saw it.

interface Props {
  match: Match;
  members: Member[];
  /** Live scoring already owns the top of the page — don't compete with it. */
  compact?: boolean;
}

export function MatchDay({ match, members, compact = false }: Props) {
  const { me } = useMe();
  const { rows } = useChallenges();

  const byId = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);
  const squad = useMemo(
    () => (match.players ?? []).map(p => byId.get(p.member_id)).filter(Boolean) as Member[],
    [match.players, byId],
  );
  const picked = !!me && squad.some(s => s.id === me.id);

  /**
   * Availability, for the window before the XI is picked. A match-day screen
   * that shows an empty squad is worse than one that shows who said yes.
   */
  const available = useMemo(
    () => (match.polls ?? []).filter(p => p.response === 'available').length,
    [match.polls],
  );

  /**
   * Challenges that today can actually move: running, either pinned to this
   * fixture or open to any match, and with someone in today's squad on them.
   * Without that last test the list fills with bets nobody present can settle,
   * which is how a "what's at stake" panel stops meaning anything.
   */
  const atStake = useMemo(() => {
    const playing = new Set(squad.map(s => s.id));
    return rows.filter(c =>
      (c.status === 'live' || c.status === 'open') &&
      (c.match_id === match.id || c.match_id === null) &&
      (c.players ?? []).some(p => p.accepted && playing.has(p.member_id)),
    );
  }, [rows, squad, match.id]);

  const nameOf = (id: string) => byId.get(id)?.name.split(' ')[0] ?? '—';
  const mapUrl = match.venue
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(match.venue)}`
    : null;

  return (
    <div className="relative overflow-hidden r-card text-white shadow-2xl m-enter"
      style={{ background: 'linear-gradient(150deg,#7f1d1d 0%,#b91c1c 45%,#ea580c 100%)' }}>
      {/* Warm bloom so the flat gradient reads as light rather than paint. */}
      <div className="absolute -top-24 -right-16 w-64 h-64 rounded-full bg-amber-300/25 blur-3xl
                      pointer-events-none" />

      <div className="relative p-5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span className="t-micro font-black uppercase tracking-[2px] text-white/90">
            Match day
          </span>
          {picked && (
            <span className="t-micro font-black uppercase tracking-wider px-2 py-0.5 rounded-full
                             bg-white/25 text-white">You're in</span>
          )}
        </div>

        <p className="font-display text-3xl font-extrabold mt-1 leading-tight">
          {match.opponent || 'SCC'}
        </p>

        {match.venue && (
          <div className="flex items-center gap-2 mt-2.5">
            <p className="t-meta text-white/75 inline-flex items-center gap-1 min-w-0 flex-1">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{match.venue}</span>
            </p>
            {/* The single most useful thing an app can do on the morning of a
                match, and it was nowhere in the club's version of one. */}
            {mapUrl && (
              <a href={mapUrl} target="_blank" rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 r-control
                           bg-white/20 text-white t-micro font-black uppercase tracking-wider">
                <Navigation className="w-3.5 h-3.5" /> Directions
              </a>
            )}
          </div>
        )}

        {!compact && (
          <>
            {/* ── Who's playing ─────────────────────────────────────────── */}
            <div className="mt-4 pt-4 border-t border-white/20">
              {squad.length > 0 ? (
                <>
                  <div className="flex items-center justify-between">
                    <p className="t-micro font-black uppercase tracking-[1.5px] text-white/60">
                      The squad
                    </p>
                    <p className="t-num text-sm text-white/90">{squad.length}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {squad.map(s => (
                      <span key={s.id}
                        className={`t-micro font-bold px-2 py-1 rounded-full ${
                          s.id === me?.id ? 'bg-white text-red-700' : 'bg-white/15 text-white/90'}`}>
                        {s.name.split(' ')[0]}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <Link to={`/poll/${match.id}`} className="flex items-center gap-2">
                  <div className="flex-1">
                    <p className="t-micro font-black uppercase tracking-[1.5px] text-white/60">
                      Squad not picked yet
                    </p>
                    <p className="font-black t-lead mt-0.5">
                      {available} said they're available
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/70" />
                </Link>
              )}
            </div>

            {/* ── What's riding on it ───────────────────────────────────── */}
            {atStake.length > 0 && (
              <Link to="/challenges" className="block mt-3 pt-3 border-t border-white/20 group">
                <p className="t-micro font-black uppercase tracking-[1.5px] text-white/60
                              inline-flex items-center gap-1.5">
                  <Swords className="w-3.5 h-3.5" /> Riding on today
                </p>
                <div className="mt-2 space-y-1.5">
                  {atStake.slice(0, 3).map(c => {
                    const on = (c.players ?? []).filter(p => p.accepted).map(p => nameOf(p.member_id));
                    return (
                      <div key={c.id} className="flex items-center gap-2">
                        <p className="t-meta font-bold truncate flex-1">
                          {c.title || 'A challenge'}
                          <span className="text-white/60 font-semibold"> · {on.join(' v ')}</span>
                        </p>
                        {c.stake && (
                          <span className="t-micro font-black px-2 py-0.5 rounded-full bg-white/20
                                           text-white shrink-0">{c.stake}</span>
                        )}
                      </div>
                    );
                  })}
                  {atStake.length > 3 && (
                    <p className="t-meta text-white/60">+{atStake.length - 3} more</p>
                  )}
                </div>
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
