import { useMemo, useState } from 'react';
import { Gavel, UserMinus, ScrollText, ChevronDown, Crown, Trophy, ExternalLink, Wallet, CalendarDays } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { TeamCrest } from '../components/TeamCrest';
import { useMatches } from '../hooks/useMatches';
import { useMembers } from '../hooks/useMembers';
import {
  useSCCLeague, PURSE_LAKH, SQUAD_SIZE, SQUAD_TARGET, formatPrice,
} from '../hooks/useSCCLeague';
import { ALL_RULES } from '../config/leagueRules';
import { useAuctionLive, type TeamKey } from '../hooks/useAuctionLive';
import { SEASON_NEW, LEAGUE_TEAM_NAMES, MAHASANGRAM } from '../config/season2';
import type { Member } from '../types';

// ─── SCC League — the squad ────────────────────────────────────────────────────
// Registration and the captain election are both finished, so this page is now
// purely the record: who signed up, what grade they carry into the auction, and
// the rules everyone agreed to. No forms, no ballots.

const TEAM_COLOR: Record<TeamKey, string> = { team1: '#2a78d6', team2: '#eb6834' };

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

  // ─── Auction result ──────────────────────────────────────────────────────
  // The auction is done, so this page stops being a preview and becomes the
  // record: who ended up where, and what they cost.
  const A = useAuctionLive(SEASON_NEW, { live: false });
  const auction = A.auction;
  const done = auction?.status === 'done';
  const [openTeam, setOpenTeam] = useState<TeamKey>('team1');

  const basePriceOf = useMemo(() => {
    const m: Record<string, number> = {};
    league.registrations.forEach(r => { if (r.base_price) m[r.member_id] = r.base_price; });
    return m;
  }, [league.registrations]);

  const rosters = useMemo(() => {
    const build = (t: TeamKey) => {
      const capId = (t === 'team1' ? auction?.team1_captain_id : auction?.team2_captain_id) ?? null;
      const bought = A.sold
        .filter(p => p.team === t)
        .map(p => ({
          id: p.member_id, price: p.price, allocated: p.round === 0,
          member: memberById[p.member_id],
        }))
        .sort((x, y) => y.price - x.price);
      const capSpend = capId ? (basePriceOf[capId] ?? 0) : 0;
      return {
        key: t,
        name: (t === 'team1' ? auction?.team1_name : auction?.team2_name) || LEAGUE_TEAM_NAMES[t],
        captain: capId ? memberById[capId] : undefined,
        capSpend,
        bought,
        size: bought.length + (capId ? 1 : 0),
        spent: capSpend + bought.reduce((n, b) => n + b.price, 0),
      };
    };
    return [build('team1'), build('team2')];
  }, [auction, A.sold, memberById, basePriceOf]);

  /** The names that went for the most, across both squads. */
  const topBuys = useMemo(
    () => [...A.sold].sort((a, b) => b.price - a.price).slice(0, 5)
      .map(p => ({ ...p, member: memberById[p.member_id] })),
    [A.sold, memberById],
  );

  /**
   * MahaSangram fixtures, pulled from the same `matches` table the rest of the
   * app uses — the CricHeroes sync writes them in as internal matches. Kept
   * apart from the older Dhurandars/Bazigars games, which are their own rivalry.
   */
  const { matches } = useMatches();
  const fixtures = useMemo(
    () => matches
      .filter(m => m.match_type === 'internal' &&
        /brahmos|agni|mahasangram/i.test(m.opponent ?? ''))
      .sort((a, b) => {
        const aUp = a.result === 'upcoming', bUp = b.result === 'upcoming';
        if (aUp !== bUp) return aUp ? -1 : 1;
        const ta = new Date(a.date).getTime(), tb = new Date(b.date).getTime();
        return aUp ? ta - tb : tb - ta;
      }),
    [matches],
  );
  const playedCount = fixtures.filter(f => f.result !== 'upcoming').length;

  const totalSpend = rosters.reduce((n, r) => n + r.spent, 0);


  return (
    <div className="min-h-screen">
      <Header title="SCC MahaSangram" subtitle={`Brahmos vs Agni · Season ${SEASON_NEW}`} />
      <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-4">

        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white shadow-2xl"
          style={{ background: 'radial-gradient(900px 400px at 85% -10%, #7c3aed 0%, transparent 55%), linear-gradient(140deg,#1e1b4b 5%,#4c1d95 45%,#9d174d 100%)' }}>
          <div className="blob-anim absolute -top-24 -right-16 w-72 h-72 rounded-full pointer-events-none"
            style={{ background: '#f472b6', filter: 'blur(80px)', opacity: .35 }} />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 border border-white/25
                             backdrop-blur px-3 py-1 text-[10px] font-black uppercase tracking-[3px]">
              <Trophy className="w-3 h-3" /> {done ? 'Squads are set' : 'Auction league'}
            </span>
            <h1 className="font-display text-4xl sm:text-5xl font-extrabold mt-3 leading-[1.05]">
              SCC <span style={{
                background: 'linear-gradient(90deg,#fde68a,#fbbf24 45%,#f472b6)',
                WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
              }}>MahaSangram</span>
            </h1>
            <p className="text-white/70 text-sm mt-2">
              {MAHASANGRAM.tagline}
            </p>

            {done && (
              <div className="grid grid-cols-3 gap-2.5 mt-5">
                {[
                  { v: String(A.sold.length), l: 'Players sold' },
                  { v: formatPrice(totalSpend), l: 'Total spend' },
                  { v: topBuys[0] ? formatPrice(topBuys[0].price) : '—', l: 'Top buy' },
                ].map(k => (
                  <div key={k.l} className="rounded-2xl bg-white/10 border border-white/15 px-2 py-3 text-center">
                    <p className="font-display text-xl sm:text-2xl font-extrabold leading-none">{k.v}</p>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-white/55 mt-1.5">{k.l}</p>
                  </div>
                ))}
              </div>
            )}

            <a href={MAHASANGRAM.cricHeroesUrl} target="_blank" rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white text-slate-900
                         font-black text-sm px-5 py-3 shadow-lg hover:-translate-y-0.5 transition-transform">
              Scorecards on CricHeroes <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        {done && (
          <>
            {/* ── PURSE, HEAD TO HEAD ──────────────────────────────────── */}
            <div className="glass rounded-3xl p-5">
              <p className="text-[11px] font-black uppercase tracking-[2px] text-slate-400 mb-3.5
                            flex items-center gap-1.5">
                <Wallet className="w-4 h-4" /> How the purses went
              </p>
              {rosters.map(r => (
                <div key={r.key} className="mb-3 last:mb-0">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="inline-flex items-center gap-2 text-sm font-black text-slate-800 dark:text-white">
                      <TeamCrest team={r.key} size={22} /> {r.name}
                    </span>
                    <span className="text-xs font-bold tabular-nums" style={{ color: TEAM_COLOR[r.key] }}>
                      {formatPrice(r.spent)}
                      <span className="text-slate-400 font-medium"> of {formatPrice(PURSE_LAKH)}</span>
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(100, (r.spent / PURSE_LAKH) * 100)}%`,
                        background: TEAM_COLOR[r.key],
                      }} />
                  </div>
                </div>
              ))}
            </div>

            {/* ── FIXTURES ─────────────────────────────────────────────── */}
            <div className="glass rounded-3xl p-5">
              <div className="flex items-baseline justify-between mb-3.5">
                <p className="text-[11px] font-black uppercase tracking-[2px] text-slate-400
                              inline-flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4" /> Fixtures
                </p>
                <span className="text-[11px] font-bold text-slate-400">
                  {playedCount} played · {fixtures.length - playedCount} to come
                </span>
              </div>

              {fixtures.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-white/50 leading-snug">
                  No fixtures published yet. They appear here automatically once
                  they're on CricHeroes.
                </p>
              ) : (
                <div className="space-y-2">
                  {fixtures.slice(0, 6).map(f => {
                    const up = f.result === 'upcoming';
                    return (
                      <div key={f.id}
                        className="flex items-center gap-3 rounded-2xl bg-white/60 dark:bg-white/5 px-3.5 py-3">
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <TeamCrest team="team1" size={26} />
                          <span className="text-[10px] font-black text-slate-400">v</span>
                          <TeamCrest team="team2" size={26} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-black text-slate-900 dark:text-white">
                            {new Date(f.date).toLocaleDateString('en-IN',
                              { weekday: 'short', day: 'numeric', month: 'short' })}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">{f.venue || '—'}</p>
                        </div>
                        {up ? (
                          <span className="flex-shrink-0 rounded-full bg-emerald-50 dark:bg-emerald-400/10
                                           border border-emerald-200 dark:border-emerald-400/20 px-2.5 py-1
                                           text-[10px] font-black text-emerald-700 dark:text-emerald-300">
                            Upcoming
                          </span>
                        ) : (
                          <span className="flex-shrink-0 text-[11px] font-black tabular-nums
                                           text-slate-700 dark:text-white/80">
                            {f.our_score || '—'} · {f.opponent_score || '—'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── THE SQUADS ───────────────────────────────────────────────
                A switcher rather than two columns: on a phone, side-by-side
                squads of fifteen means neither is readable. */}
            <div className="glass rounded-3xl overflow-hidden">
              <div className="grid grid-cols-2">
                {rosters.map(r => {
                  const on = openTeam === r.key;
                  return (
                    <button key={r.key} onClick={() => setOpenTeam(r.key)}
                      className={`px-3 py-4 text-center transition-all ${on ? 'text-white' : 'text-slate-500 dark:text-white/50'}`}
                      style={{ background: on ? TEAM_COLOR[r.key] : 'transparent' }}>
                      <TeamCrest team={r.key} size={34} />
                      <span className="block font-black text-sm mt-1.5">{r.name}</span>
                      <span className={`block text-[10px] font-bold mt-0.5 ${on ? 'text-white/70' : 'text-slate-400'}`}>
                        {r.size} players · {formatPrice(r.spent)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {rosters.filter(r => r.key === openTeam).map(r => (
                <div key={r.key}>
                  {/* captain first, always */}
                  {r.captain && (
                    <div className="flex items-center gap-3 px-4 py-3 border-b-2"
                      style={{ borderColor: `${TEAM_COLOR[r.key]}33`, background: `${TEAM_COLOR[r.key]}0f` }}>
                      <Avatar member={r.captain} size={44} ring={TEAM_COLOR[r.key]} />
                      <div className="min-w-0 flex-1">
                        <p className="font-black text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                          {r.captain.name}
                          <Crown className="w-3.5 h-3.5 text-amber-500" fill="currentColor" />
                        </p>
                        <p className="text-[11px] font-bold" style={{ color: TEAM_COLOR[r.key] }}>
                          Captain · retained
                        </p>
                      </div>
                      <span className="font-black text-slate-400 tabular-nums text-sm">
                        {formatPrice(r.capSpend)}
                      </span>
                    </div>
                  )}
                  <div className="divide-y divide-slate-100 dark:divide-white/10">
                    {r.bought.map((b, i) => (
                      <div key={b.id} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="w-5 text-center text-[11px] font-black text-slate-300 dark:text-white/25">
                          {i + 1}
                        </span>
                        <Avatar member={b.member} size={34} />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-[13px] text-slate-900 dark:text-white truncate">
                            {b.member?.name ?? '?'}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Base {formatPrice(basePriceOf[b.id] ?? 20)}
                            {b.allocated && ' · allocated at close'}
                          </p>
                        </div>
                        <span className="font-black tabular-nums text-sm flex-shrink-0"
                          style={{ color: TEAM_COLOR[r.key] }}>
                          {formatPrice(b.price)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* ── TOP BUYS ─────────────────────────────────────────────── */}
            {topBuys.length > 0 && (
              <div className="glass rounded-3xl p-5">
                <p className="text-[11px] font-black uppercase tracking-[2px] text-slate-400 mb-3
                              flex items-center gap-1.5">
                  <Gavel className="w-4 h-4" /> Biggest buys of the night
                </p>
                <div className="space-y-2">
                  {topBuys.map((b, i) => (
                    <div key={b.id} className="flex items-center gap-3">
                      <span className={`w-6 text-center font-display text-lg font-extrabold ${
                        i === 0 ? 'text-amber-500' : 'text-slate-300 dark:text-white/25'}`}>
                        {i + 1}
                      </span>
                      <Avatar member={b.member} size={34} />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-[13px] text-slate-900 dark:text-white truncate">
                          {b.member?.name ?? '?'}
                        </p>
                        <p className="inline-flex items-center gap-1.5 text-[10px] font-bold"
                          style={{ color: TEAM_COLOR[b.team as TeamKey] }}>
                          <TeamCrest team={b.team as TeamKey} size={14} />
                          {rosters.find(r => r.key === b.team)?.name}
                        </p>
                      </div>
                      <span className="font-black tabular-nums text-slate-900 dark:text-white">
                        {formatPrice(b.price)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
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
