import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, ChevronRight, ExternalLink } from 'lucide-react';
import { TeamCrest } from './TeamCrest';
import { teamIdentity } from '../config/teamLogos';
import { MAHASANGRAM } from '../config/season2';
import { formatPrice } from '../hooks/useSCCLeague';
import { useAuctionLive, type TeamKey } from '../hooks/useAuctionLive';
import { SEASON_NEW } from '../config/season2';
import type { Match } from '../types';

// ─── MahaSangram on the Dashboard ──────────────────────────────────────────────
// The season's headline story in one card: the two squads that came out of the
// auction, and the head-to-head once they start playing. Deliberately separate
// from the old Dhurandars/Bazigars rivalry block — that one is its own history
// and keeps its own record.

interface Props {
  /** All matches; MahaSangram fixtures are filtered out of these. */
  matches: Match[];
}

export function MahaSangramCard({ matches }: Props) {
  const A = useAuctionLive(SEASON_NEW, { live: false });
  const a = A.auction;

  const squadSize = (t: TeamKey) => {
    const capId = t === 'team1' ? a?.team1_captain_id : a?.team2_captain_id;
    return A.sold.filter(p => p.team === t).length + (capId ? 1 : 0);
  };
  const spend = (t: TeamKey) => {
    const capId = t === 'team1' ? a?.team1_captain_id : a?.team2_captain_id;
    const base = capId ? 200 : 0;   // both captains are Marquee
    return base + A.sold.filter(p => p.team === t).reduce((n, p) => n + p.price, 0);
  };

  /**
   * Head-to-head, once MahaSangram fixtures exist. Until the sync is wired to
   * the new CricHeroes teams there are none, so the card shows the squads
   * instead of pretending to a record nobody has played for.
   */
  const record = useMemo(() => {
    const played = matches.filter(
      m => m.match_type === 'internal' &&
        /mahasangram|brahmos|agni/i.test(`${m.opponent ?? ''} ${m.notes ?? ''}`),
    );
    return { played: played.length };
  }, [matches]);

  if (!a || a.status !== 'done') return null;

  const teams: TeamKey[] = ['team1', 'team2'];

  return (
    <div className="relative overflow-hidden rounded-3xl shadow-xl text-white"
      style={{ background: 'linear-gradient(135deg,#1e1b4b 0%,#312e81 45%,#4c1d95 100%)' }}>
      <div className="absolute -top-20 -right-12 w-56 h-56 rounded-full pointer-events-none"
        style={{ background: '#a855f7', filter: 'blur(80px)', opacity: .35 }} />

      <div className="relative p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[2.5px] text-white/70">
            <Trophy className="w-3 h-3" /> SCC MahaSangram
          </span>
          <a href={MAHASANGRAM.cricHeroesUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] font-bold text-white/60 hover:text-white">
            CricHeroes <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* the two squads, face to face */}
        <div className="flex items-center gap-3 mt-4">
          {teams.map((t, i) => {
            const id = teamIdentity(t);
            return (
              <div key={t} className="flex-1 min-w-0">
                {i === 1 && null}
                <div className="flex items-center gap-2.5">
                  <TeamCrest team={t} size={44} />
                  <div className="min-w-0">
                    <p className="font-display text-base font-extrabold leading-tight truncate"
                      style={{ color: id.color }}>
                      {id.name.replace('SCC ', '')}
                    </p>
                    <p className="text-[10px] text-white/50">
                      {squadSize(t)} players · {formatPrice(spend(t))}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-center text-[11px] text-white/45 mt-3">
          {record.played > 0
            ? `${record.played} played`
            : 'Squads locked — fixtures to come'}
        </p>

        <Link to="/scc-league"
          className="mt-4 flex items-center justify-center gap-1.5 rounded-2xl bg-white/12
                     border border-white/20 py-2.5 text-[11px] font-black hover:bg-white/20 transition-colors">
          See both squads <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
