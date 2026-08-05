import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Gavel, Flame, UserMinus, ScrollText, ChevronDown, Radio, Crown } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { useMembers } from '../hooks/useMembers';
import {
  useSCCLeague, ROLE_LABELS, DISPLAY_BANDS, bandForPrice, PURSE_LAKH, SQUAD_SIZE, SQUAD_TARGET,
  formatPrice, type LeagueRole,
} from '../hooks/useSCCLeague';
import { ALL_RULES } from '../config/leagueRules';
import { SEASON_NEW, LEAGUE_CAPTAIN_IDS, LEAGUE_TEAM_NAMES, isLeagueCaptain } from '../config/season2';
import type { Member } from '../types';

// ─── SCC League — the squad ────────────────────────────────────────────────────
// Registration and the captain election are both finished, so this page is now
// purely the record: who signed up, what grade they carry into the auction, and
// the rules everyone agreed to. No forms, no ballots.

const ROLE_EMOJI: Record<LeagueRole, string> = {
  batter: '🏏', bowler: '🎯', allrounder: '⚡', keeper: '🧤',
};

function Avatar({ member, size = 44, ring }: { member?: Member; size?: number; ring?: string }) {
  return member?.avatar_url ? (
    <img src={member.avatar_url} alt="" className="rounded-full object-cover flex-shrink-0"
      style={{ width: size, height: size, border: ring ? `2px solid ${ring}` : undefined }} />
  ) : (
    <div className="rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-white font-black
                    flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.42, border: ring ? `2px solid ${ring}` : undefined }}>
      {member?.name?.charAt(0) ?? '?'}
    </div>
  );
}

export function SCCLeague() {
  const { members } = useMembers();
  const league = useSCCLeague(SEASON_NEW);

  const memberById = useMemo(
    () => Object.fromEntries(members.map(m => [m.id, m])) as Record<string, Member>,
    [members],
  );

  /** The pool the auction actually bids on — captains are retained, not sold. */
  const squad = useMemo(
    () => league.going.filter(r => !isLeagueCaptain(r.member_id)).sort((a, b) =>
      (b.base_price || 0) - (a.base_price || 0) ||
      (memberById[a.member_id]?.name ?? '').localeCompare(memberById[b.member_id]?.name ?? ''),
    ),
    [league.going, memberById],
  );

  const byTier = useMemo(
    () => DISPLAY_BANDS.map(tier => ({
      tier,
      // Within the Icons band the ₹2 Cr names sit above the ₹1 Cr ones.
      players: squad.filter(r => bandForPrice(r.base_price).key === tier.key)
        .sort((a, b) => (b.base_price || 0) - (a.base_price || 0)),
    })).filter(g => g.players.length > 0),
    [squad],
  );

  const roleCount = league.roleCounts;

  return (
    <div className="min-h-screen">
      <Header title="SCC League" subtitle={`The squad · Season ${SEASON_NEW}`} />
      <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-4">

        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white shadow-2xl"
          style={{ background: 'radial-gradient(900px 400px at 85% -10%, #7c3aed 0%, transparent 55%), linear-gradient(140deg,#1e1b4b 5%,#4c1d95 45%,#9d174d 100%)' }}>
          <div className="blob-anim absolute -top-24 -right-16 w-72 h-72 rounded-full pointer-events-none"
            style={{ background: '#f472b6', filter: 'blur(80px)', opacity: .35 }} />

          <div className="relative text-center">
            <span className="inline-flex items-center gap-1.5 bg-white/15 border border-white/25 backdrop-blur
                             rounded-full px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[3px]">
              <Gavel className="w-3.5 h-3.5" /> Auction League
            </span>
            <h1 className="font-display text-4xl sm:text-5xl font-extrabold mt-3 leading-[1.05] drop-shadow">
              SCC <span style={{ background: 'linear-gradient(90deg,#fde68a,#fbbf24 45%,#f472b6)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>League</span>
            </h1>
            <p className="text-white/85 text-sm mt-2.5 max-w-md mx-auto font-medium">
              Registration closed. {squad.length} players go under the hammer, graded and
              waiting for a bid 🔨
            </p>

            <div className="grid grid-cols-3 gap-2.5 mt-6 max-w-sm mx-auto">
              {[
                { v: String(squad.length), l: 'In the pool' },
                { v: formatPrice(PURSE_LAKH), l: 'Purse / team' },
                { v: String(SQUAD_SIZE), l: 'Players / squad' },
              ].map(k => (
                <div key={k.l} className="bg-white/12 border border-white/20 rounded-2xl py-3">
                  <p className="font-display text-lg font-extrabold leading-none">{k.v}</p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-white/70 mt-1">{k.l}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap justify-center gap-1.5 mt-4">
              {(Object.keys(ROLE_LABELS) as LeagueRole[]).map(r => (
                <span key={r} className="text-[10px] font-bold bg-white/15 rounded-full px-2.5 py-1">
                  {ROLE_EMOJI[r]} {roleCount[r] ?? 0}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── WATCH THE AUCTION ────────────────────────────────────────── */}
        <Link to="/auction-live"
          className="block rounded-2xl px-5 py-4 shadow-lg"
          style={{ background: 'linear-gradient(110deg,#0f172a,#4c1d95 60%,#db2777)' }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center text-xl">🔨</div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-black text-base flex items-center gap-2">
                Live Auction <Radio className="w-3.5 h-3.5 text-rose-400" />
              </p>
              <p className="text-white/80 text-xs font-medium">
                Watch every bid as it happens — open it on your phone on auction night
              </p>
            </div>
          </div>
        </Link>

        {/* ── CAPTAINS ─────────────────────────────────────────────────── */}
        <div className="glass rounded-3xl p-5">
          <p className="text-[11px] font-black uppercase tracking-[2px] text-amber-600 mb-1 flex items-center gap-1.5">
            <Crown className="w-4 h-4" fill="currentColor" /> Your captains
          </p>
          <p className="text-xs text-slate-500 dark:text-white/60 mb-3">
            Elected by the squad. They build their teams at the auction — and are
            <b> not auctioned themselves</b>.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {LEAGUE_CAPTAIN_IDS.map((id, i) => (
              <div key={id} className="rounded-2xl p-4 text-white text-center shadow-md"
                style={{ background: i === 0
                  ? 'linear-gradient(140deg,#1e3a8a,#2a78d6)'
                  : 'linear-gradient(140deg,#7c2d12,#eb6834)' }}>
                <div className="flex justify-center">
                  <Avatar member={memberById[id]} size={64} ring="rgba(255,255,255,.55)" />
                </div>
                <p className="text-[9px] font-black uppercase tracking-widest text-white/60 mt-2.5">
                  Team {i + 1}
                </p>
                <p className="font-display text-lg font-extrabold leading-tight mt-0.5">
                  {i === 0 ? LEAGUE_TEAM_NAMES.team1 : LEAGUE_TEAM_NAMES.team2}
                </p>
                <p className="text-[10px] text-white/70 inline-flex items-center gap-1 mt-1">
                  <Crown className="w-3 h-3" fill="currentColor" /> {memberById[id]?.name ?? '?'}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── THE POOL, BY GRADE ───────────────────────────────────────── */}
        {byTier.map(({ tier, players }) => (
          <div key={tier.key} className="glass rounded-3xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">{tier.emoji}</span>
              <p className="text-[11px] font-black uppercase tracking-[2px] text-slate-600 dark:text-white/70">
                {tier.label}
              </p>
              <span className={`text-[10px] font-black text-white rounded-full px-2 py-0.5 bg-gradient-to-r ${tier.cls}`}>
                {(() => {
                  const prices = [...new Set(players.map(p => p.base_price))].sort((a, b) => b - a);
                  return prices.length > 1
                    ? `${formatPrice(prices[prices.length - 1])}–${formatPrice(prices[0])}`
                    : formatPrice(prices[0]);
                })()}
              </span>
              <span className="ml-auto text-[11px] font-bold text-slate-400">{players.length}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {players.map(r => {
                const m = memberById[r.member_id];
                return (
                  <div key={r.id} className="flex items-start gap-2.5 rounded-2xl bg-white/60 dark:bg-white/5 p-2.5">
                    <Avatar member={m} size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {m?.name ?? '?'}
                        <span className="ml-1.5 text-[10px] font-black text-violet-500">{formatPrice(r.base_price)}</span>
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-white/55">
                        {r.role ? ROLE_LABELS[r.role as LeagueRole] : '—'}
                        {!r.can_commit && ' · limited availability'}
                      </p>
                      {r.pitch && (
                        <p className="text-[10px] italic text-slate-400 dark:text-white/45 mt-0.5 line-clamp-2">
                          "{r.pitch}"
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {squad.length === 0 && !league.loading && (
          <div className="glass rounded-3xl p-8 text-center">
            <Flame className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500 dark:text-white/60">Nobody registered yet.</p>
          </div>
        )}

        {/* ── SITTING OUT ──────────────────────────────────────────────── */}
        {league.sittingOut.length > 0 && (
          <div className="glass rounded-3xl p-5">
            <p className="text-[11px] font-black uppercase tracking-[2px] text-slate-400 mb-3 flex items-center gap-1.5">
              <UserMinus className="w-4 h-4" /> Sitting this one out · {league.sittingOut.length}
            </p>
            <div className="flex flex-wrap gap-2">
              {league.sittingOut.map(r => (
                <div key={r.id} className="flex items-center gap-2 rounded-full bg-slate-100 dark:bg-white/10 pl-1 pr-3 py-1">
                  <Avatar member={memberById[r.member_id]} size={24} />
                  <span className="text-xs font-bold text-slate-500 dark:text-white/60">
                    {memberById[r.member_id]?.name?.split(' ')[0] ?? '?'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── RULEBOOK ─────────────────────────────────────────────────── */}
        <div className="glass rounded-3xl p-5 sm:p-6">
          <p className="text-[11px] font-black uppercase tracking-[2px] text-slate-600 dark:text-white/70 mb-1 flex items-center gap-1.5">
            <ScrollText className="w-4 h-4" /> The rulebook
          </p>
          <p className="text-xs text-slate-500 dark:text-white/60 mb-4">
            Everything settled up front so auction night is arguments about <i>players</i>, not rules 😄
          </p>

          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { v: formatPrice(PURSE_LAKH), l: 'Purse / team', c: 'from-amber-400 to-orange-500' },
              { v: String(SQUAD_SIZE), l: 'Players / squad', c: 'from-violet-500 to-purple-600' },
              { v: String(SQUAD_TARGET), l: 'Needed to start', c: 'from-emerald-500 to-teal-500' },
            ].map(k => (
              <div key={k.l} className={`rounded-2xl p-3 text-center text-white bg-gradient-to-br ${k.c} shadow-md`}>
                <p className="font-display text-lg font-extrabold leading-none">{k.v}</p>
                <p className="text-[9px] font-bold uppercase tracking-wider text-white/80 mt-1">{k.l}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            {ALL_RULES.map(section => (
              <details key={section.title} className="group rounded-2xl bg-white/60 dark:bg-white/5 overflow-hidden">
                <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer list-none">
                  <span className="text-lg">{section.emoji}</span>
                  <span className="flex-1 font-bold text-sm text-slate-800 dark:text-white">{section.title}</span>
                  <span className="text-[10px] font-bold text-slate-400">{section.rules.length} rules</span>
                  <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
                </summary>
                <ol className="px-4 pb-4 space-y-2">
                  {section.rules.map((rule, i) => (
                    <li key={i} className="flex gap-2.5 text-[12.5px] leading-relaxed text-slate-600 dark:text-white/70">
                      <span className="font-black text-violet-500 shrink-0">{i + 1}.</span>
                      <span dangerouslySetInnerHTML={{
                        __html: rule.replace(/\*\*(.+?)\*\*/g, '<b class="text-slate-900 dark:text-white">$1</b>'),
                      }} />
                    </li>
                  ))}
                </ol>
              </details>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SCCLeague;
