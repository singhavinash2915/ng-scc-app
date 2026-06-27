import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Loader2 } from 'lucide-react';
import { useMembers } from '../hooks/useMembers';
import { CH_PLAYER_TO_MEMBER } from '../hooks/useStatSync';
import { useMatchHeroes, type BestBat, type BestBowl, type MatchHeroes as Heroes } from '../hooks/useMatchAnalysis';

interface HeroCard {
  role: string;
  emoji: string;
  player_id: number;
  name: string;
  team: string;
  photo: string | null;
  line: string;        // stat line, e.g. "16 (15) · 4-0-22-3"
}

// Build a "16 (15)  1×4 0×6" style batting line.
function batLine(b: BestBat | undefined) {
  if (!b) return '';
  return `${b.runs}${b.is_out ? '' : '*'} (${b.balls})`;
}
function bowlLine(b: BestBowl | undefined) {
  if (!b) return '';
  return `${b.overs}-${b.maidens}-${b.runs}-${b.wickets}`;
}

function impact(bat?: BestBat, bowl?: BestBowl) {
  return (bat ? bat.runs + bat['4s'] + bat['6s'] * 2 : 0) + (bowl ? bowl.wickets * 18 - bowl.runs * 0.3 : 0);
}

function buildCards(h: Heroes): HeroCard[] {
  const bat = h.best_performances.batting ?? [];
  const bowl = h.best_performances.bowling ?? [];
  const batBy = (id: number) => bat.find(b => b.player_id === id);
  const bowlBy = (id: number) => bowl.find(b => b.player_id === id);
  const cards: HeroCard[] = [];
  const used = new Set<number>();

  // show: 'both' (PoM/all-rounder), 'bat' (best batter), 'bowl' (best bowler)
  const push = (role: string, emoji: string, pid: number, name: string, team: string, photo: string | null, show: 'both' | 'bat' | 'bowl' = 'both') => {
    const b = batBy(pid), bw = bowlBy(pid);
    const parts = (show === 'bat' ? [batLine(b)]
      : show === 'bowl' ? [bowlLine(bw)]
      : [batLine(b), bowlLine(bw)]).filter(Boolean);
    cards.push({ role, emoji, player_id: pid, name, team, photo, line: parts.join('  ·  ') });
    used.add(pid);
  };

  if (h.player_of_the_match) {
    const p = h.player_of_the_match;
    push('Player of the Match', '🏆', p.player_id, p.player_name, p.team_name, p.profile_photo || null, 'both');
  }
  if (bat[0]) push('Best Batter', '🏏', bat[0].player_id, bat[0].player_name, bat[0].team_name, null, 'bat');
  if (bowl[0]) push('Best Bowler', '⚡', bowl[0].player_id, bowl[0].player_name, bowl[0].team_name, null, 'bowl');

  // All-rounder / "Fighter": top combined impact among players who both batted
  // and bowled, not already featured above.
  const allRound = bat
    .filter(b => bowlBy(b.player_id))
    .map(b => ({ b, bw: bowlBy(b.player_id)!, score: impact(b, bowlBy(b.player_id)) }))
    .sort((a, b) => b.score - a.score)[0];
  if (allRound && !used.has(allRound.b.player_id)) {
    push('All-Rounder', '🔥', allRound.b.player_id, allRound.b.player_name, allRound.b.team_name, null);
  }
  return cards;
}

export function MatchHeroes({ chMatchId }: { chMatchId: string }) {
  const { data, loading, error } = useMatchHeroes(chMatchId);
  const { members } = useMembers();

  const memberByCh = useMemo(() => {
    const byId: Record<string, { id: string; name: string; avatar_url: string | null }> = {};
    members.forEach(m => { byId[m.id] = { id: m.id, name: m.name, avatar_url: m.avatar_url ?? null }; });
    const out: Record<number, { id: string; avatar_url: string | null }> = {};
    for (const [chId, uuid] of Object.entries(CH_PLAYER_TO_MEMBER)) {
      if (byId[uuid]) out[Number(chId)] = { id: uuid, avatar_url: byId[uuid].avatar_url };
    }
    return out;
  }, [members]);

  const cards = useMemo(() => (data ? buildCards(data) : []), [data]);

  if (loading) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 text-purple-400 animate-spin" /></div>;
  }
  if (error || !data || cards.length === 0) {
    return <p className="text-center text-sm text-gray-500 py-8">Heroes of the match unavailable.</p>;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-black text-white flex items-center gap-2">
        <Trophy className="w-4 h-4 text-yellow-400" /> Heroes of the Match
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cards.map((c, i) => {
          const mem = memberByCh[c.player_id];
          const avatar = mem?.avatar_url || c.photo;
          const isOurs = c.team === 'Sangria Cricket Club' || !!mem;
          return (
            <div key={i} className="rounded-xl p-3 flex items-center gap-3 border border-white/10 bg-white/[0.03]">
              {avatar ? (
                <img src={avatar} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" crossOrigin="anonymous" />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-purple-600/30 text-purple-200 flex items-center justify-center font-black text-xl flex-shrink-0">
                  {c.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-widest text-purple-300/80 font-bold">{c.emoji} {c.role}</p>
                {mem ? (
                  <Link to={`/profile/${mem.id}`} className="font-black text-white truncate block hover:text-purple-300">{c.name}</Link>
                ) : (
                  <p className="font-black text-white truncate">{c.name}</p>
                )}
                <p className={`text-[11px] truncate ${isOurs ? 'text-emerald-400' : 'text-gray-500'}`}>{c.team}</p>
                {c.line && <p className="text-xs text-gray-300 font-semibold tabular-nums mt-0.5">{c.line}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {data.insight_statements.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-1.5">
          {data.insight_statements.slice(0, 5).map((s, i) => (
            <p key={i} className="text-[11px] text-gray-400 flex gap-2"><span className="text-purple-400">•</span>{s}</p>
          ))}
        </div>
      )}
    </div>
  );
}
