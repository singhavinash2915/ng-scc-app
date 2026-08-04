import { useCallback, useMemo, useState } from 'react';
import { Search, Crown, Radio, TrendingUp, Sparkles, Zap } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { useMembers } from '../hooks/useMembers';
import { useSCCLeague, formatPrice, PRICE_TIERS, PURSE_LAKH, SQUAD_SIZE } from '../hooks/useSCCLeague';
import { useAuctionLive, type TeamKey } from '../hooks/useAuctionLive';
import { SEASON_NEW, isLeagueCaptain } from '../config/season2';
import type { Member } from '../types';

// ─── Auction Centre ────────────────────────────────────────────────────────────
// The public side of auction night, modelled on the IPL trackers: what's live,
// what each squad has spent, and every player with the full bid trail behind
// their price. Read-only — the auctioneer's controls stay on /auction-live.

type Tab = 'live' | 'teams' | 'players';

const TEAM_COLOR: Record<TeamKey, string> = { team1: '#2a78d6', team2: '#eb6834' };
const TEAM_EMOJI: Record<TeamKey, string> = { team1: '🦁', team2: '🐅' };

function Face({ member, size = 40 }: { member?: Member; size?: number }) {
  return member?.avatar_url ? (
    <img src={member.avatar_url} alt="" className="rounded-xl object-cover flex-shrink-0"
      style={{ width: size, height: size }} />
  ) : (
    <div className="rounded-xl bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-white/60
                    font-black flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {member?.name?.charAt(0) ?? '?'}
    </div>
  );
}

export function AuctionCentre() {
  const { members } = useMembers();
  const league = useSCCLeague(SEASON_NEW);
  // Base prices come from the league grades; the hook needs them to deduct
  // each captain's retention from their own purse.
  const baseOf = useCallback(
    (id: string) => league.registrations.find(r => r.member_id === id)?.base_price ?? 20,
    [league.registrations],
  );
  const A = useAuctionLive(SEASON_NEW, { basePriceOf: baseOf });
  const [tab, setTab] = useState<Tab>('live');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const memberById = useMemo(
    () => Object.fromEntries(members.map(m => [m.id, m])) as Record<string, Member>,
    [members],
  );

  const a = A.auction;
  const name = (t: TeamKey) => (t === 'team1' ? a?.team1_name : a?.team2_name) || 'Team';
  const pickOf = (id: string) => A.picks.find(p => p.member_id === id);

  /** Everyone in the pool: captains are retained, so they're not listed. */
  const pool = useMemo(
    () => league.going.filter(r => !isLeagueCaptain(r.member_id)),
    [league.going],
  );

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return pool
      .filter(r => !t || (memberById[r.member_id]?.name ?? '').toLowerCase().includes(t))
      .sort((x, y) => (y.base_price || 0) - (x.base_price || 0) ||
        (memberById[x.member_id]?.name ?? '').localeCompare(memberById[y.member_id]?.name ?? ''));
  }, [pool, q, memberById]);

  /** The three cards every auction tracker leads with. */
  const featured = useMemo(() => {
    const sold = A.sold;
    if (sold.length === 0) return [];
    const top = [...sold].sort((x, y) => y.price - x.price)[0];
    const bargain = [...sold]
      .filter(p => baseOf(p.member_id) >= 50)
      .sort((x, y) => x.price / baseOf(x.member_id) - y.price / baseOf(y.member_id))[0];
    const surprise = [...sold]
      .sort((x, y) => y.price / baseOf(y.member_id) - x.price / baseOf(x.member_id))[0];
    return [
      { tag: 'TOP PICK', icon: TrendingUp, pick: top, cls: 'text-amber-500' },
      bargain && bargain.id !== top.id
        ? { tag: 'SMART BUY', icon: Sparkles, pick: bargain, cls: 'text-emerald-500' } : null,
      surprise && surprise.id !== top.id
        ? { tag: 'SURPRISE PICK', icon: Zap, pick: surprise, cls: 'text-violet-500' } : null,
    ].filter(Boolean) as Array<{ tag: string; icon: typeof TrendingUp; pick: typeof top; cls: string }>;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [A.sold, league.registrations]);

  const started = !!a;
  const TABS: Array<[Tab, string]> = [['live', 'Live'], ['teams', 'Teams'], ['players', 'Players']];

  return (
    <div className="min-h-screen">
      <Header title="Auction Centre" subtitle={`SCC League · Season ${SEASON_NEW}`} />
      <div className="p-4 lg:p-8 max-w-3xl mx-auto">

        {/* status */}
        <div className="flex items-center justify-between rounded-2xl bg-slate-900 text-white px-4 py-2.5 mb-3">
          <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest">
            <Radio className={`w-3.5 h-3.5 ${started ? 'text-rose-400' : 'text-white/30'}`} />
            {!started ? 'Auction not started' : a!.status === 'done' ? 'Auction completed' : 'Live'}
          </span>
          <span className="text-[11px] font-bold text-white/60">
            {started
              ? `${A.sold.length} sold · ${A.unsold.length} unsold`
              : `${pool.length} players · ${formatPrice(PURSE_LAKH)} a side`}
          </span>
        </div>

        {/* tabs */}
        <div className="flex gap-1 border-b border-slate-200 dark:border-white/10 mb-4">
          {TABS.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-2.5 text-sm font-black border-b-2 -mb-px transition-colors ${
                tab === k
                  ? 'border-violet-500 text-slate-900 dark:text-white'
                  : 'border-transparent text-slate-400'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* ── LIVE ─────────────────────────────────────────────────────── */}
        {tab === 'live' && (
          <div className="space-y-3">
            {!started && (
              <div className="rounded-3xl bg-white dark:bg-white/5 border border-slate-200
                              dark:border-white/10 p-6 text-center">
                <p className="text-4xl">🔨</p>
                <h2 className="text-lg font-black text-slate-900 dark:text-white mt-2">
                  Auction night is coming
                </h2>
                <p className="text-sm text-slate-500 dark:text-white/60 mt-1.5">
                  {pool.length} players graded and waiting. Browse the full list on the
                  <b> Players</b> tab — every bid lands here the moment it's called.
                </p>
              </div>
            )}
            {started && featured.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-white/60">
                Nothing sold yet — the first name is about to go under the hammer.
              </p>
            )}
            {featured.map(({ tag, icon: Icon, pick, cls }) => (
              <div key={tag} className="rounded-3xl bg-white dark:bg-white/5 border
                              border-slate-200 dark:border-white/10 overflow-hidden">
                <div className="px-4 pt-3">
                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-black
                                    uppercase tracking-widest ${cls}`}>
                    <Icon className="w-3.5 h-3.5" /> {tag}
                  </span>
                </div>
                <div className="flex items-center gap-3 px-4 py-3">
                  <Face member={memberById[pick.member_id]} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-slate-900 dark:text-white truncate">
                      {memberById[pick.member_id]?.name}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {league.registrations.find(r => r.member_id === pick.member_id)?.role ?? '—'}
                    </p>
                  </div>
                  <span className="text-[10px] font-black bg-emerald-100 text-emerald-700
                                   dark:bg-emerald-500/15 dark:text-emerald-300 rounded px-2 py-1">
                    SOLD
                  </span>
                </div>
                <div className="grid grid-cols-3 border-t border-slate-100 dark:border-white/10
                                divide-x divide-slate-100 dark:divide-white/10">
                  <Cell label="Base price" value={formatPrice(baseOf(pick.member_id))} />
                  <Cell label="Final price" value={formatPrice(pick.price)} />
                  <Cell label="Team" value={`${TEAM_EMOJI[pick.team as TeamKey]} ${name(pick.team as TeamKey)}`} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── TEAMS ────────────────────────────────────────────────────── */}
        {tab === 'teams' && !started && (
          <div className="rounded-3xl bg-white dark:bg-white/5 border border-slate-200
                          dark:border-white/10 p-6 text-center">
            <Crown className="w-8 h-8 text-amber-500 mx-auto" fill="currentColor" />
            <p className="text-sm font-black text-slate-900 dark:text-white mt-2">
              Squads get built on auction night
            </p>
            <p className="text-xs text-slate-500 dark:text-white/60 mt-1">
              {SQUAD_SIZE} a side · {formatPrice(PURSE_LAKH)} purse each
            </p>
          </div>
        )}

        {tab === 'teams' && a && (
          <div className="rounded-3xl bg-white dark:bg-white/5 border border-slate-200
                          dark:border-white/10 overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2.5 bg-slate-50
                            dark:bg-white/5 text-[10px] font-black uppercase tracking-wider text-slate-400">
              <span>Team</span><span className="text-right">Spent</span>
              <span className="text-right">Remaining</span><span className="text-right">Players</span>
            </div>
            {(['team1', 'team2'] as TeamKey[]).map(t => (
              <div key={t} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-3
                              border-t border-slate-100 dark:border-white/10 items-center">
                <span className="font-black truncate" style={{ color: TEAM_COLOR[t] }}>
                  {TEAM_EMOJI[t]} {name(t)}
                </span>
                <span className="text-sm font-bold tabular-nums text-right text-slate-900 dark:text-white">
                  {formatPrice(A.spent(t) + A.captainCost(t))}
                </span>
                <span className="text-sm font-bold tabular-nums text-right text-slate-500 dark:text-white/60">
                  {formatPrice(A.budget(t))}
                </span>
                <span className="text-sm font-bold tabular-nums text-right text-slate-500 dark:text-white/60">
                  {A.squad(t).length + 1}/{a.squad_size}
                </span>
              </div>
            ))}

            {(['team1', 'team2'] as TeamKey[]).map(t => (
              <div key={`sq-${t}`} className="border-t border-slate-100 dark:border-white/10 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest mb-2"
                  style={{ color: TEAM_COLOR[t] }}>{name(t)} squad</p>
                <div className="flex items-center gap-2 py-1">
                  <Crown className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" fill="currentColor" />
                  <span className="text-sm font-bold flex-1 truncate text-slate-900 dark:text-white">
                    {memberById[(t === 'team1' ? a.team1_captain_id : a.team2_captain_id) ?? '']?.name ?? '—'}
                  </span>
                  <span className="text-xs font-black text-slate-400">
                    {formatPrice(A.captainCost(t))}
                  </span>
                </div>
                {A.squad(t).map(p => (
                  <div key={p.id} className="flex items-center gap-2 py-1">
                    <span className="w-3.5" />
                    <span className="text-sm flex-1 truncate text-slate-600 dark:text-white/70">
                      {memberById[p.member_id]?.name}
                    </span>
                    <span className="text-xs font-black tabular-nums text-slate-900 dark:text-white">
                      {formatPrice(p.price)}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ── PLAYERS ──────────────────────────────────────────────────── */}
        {tab === 'players' && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search players"
                className="w-full rounded-2xl border border-slate-200 dark:border-white/15
                           bg-white dark:bg-white/5 pl-9 pr-3 py-2.5 text-sm" />
            </div>

            <div className="rounded-3xl bg-white dark:bg-white/5 border border-slate-200
                            dark:border-white/10 overflow-hidden">
              {filtered.map(r => {
                const m = memberById[r.member_id];
                const pick = pickOf(r.member_id);
                const trail = A.trailFor(r.member_id);
                const isOpen = open === r.member_id;
                const tier = PRICE_TIERS.find(t => t.price === r.base_price);
                return (
                  <div key={r.id} className="border-t first:border-t-0 border-slate-100 dark:border-white/10">
                    <button onClick={() => setOpen(isOpen ? null : r.member_id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left">
                      <Face member={m} size={38} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {m?.name}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {tier?.emoji} {r.role ?? '—'} · base {formatPrice(r.base_price)}
                        </p>
                      </div>
                      {pick
                        ? pick.team
                          ? <span className="text-xs font-black tabular-nums"
                              style={{ color: TEAM_COLOR[pick.team] }}>
                              {formatPrice(pick.price)}
                            </span>
                          : <span className="text-[10px] font-black text-slate-400">UNSOLD</span>
                        : <span className="text-[10px] font-bold text-slate-300">—</span>}
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4">
                        {pick?.team && (
                          <div className="grid grid-cols-3 rounded-2xl bg-slate-50 dark:bg-white/5
                                          divide-x divide-slate-200 dark:divide-white/10 mb-3">
                            <Cell label="Base price" value={formatPrice(r.base_price)} />
                            <Cell label="Final price" value={formatPrice(pick.price)} />
                            <Cell label="Team" value={`${TEAM_EMOJI[pick.team]} ${name(pick.team)}`} />
                          </div>
                        )}
                        {r.pitch && (
                          <p className="text-xs italic text-slate-500 dark:text-white/60 mb-3">"{r.pitch}"</p>
                        )}

                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                          Auction trail · {trail.length} bid{trail.length === 1 ? '' : 's'}
                        </p>
                        {trail.length === 0 ? (
                          <p className="text-xs text-slate-400">
                            {pick ? 'No bids recorded.' : 'Not yet under the hammer.'}
                          </p>
                        ) : (
                          <div className="space-y-1">
                            {trail.map((b, i) => (
                              <div key={b.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                                style={{ background: i === 0 ? `${TEAM_COLOR[b.team]}1a` : undefined }}>
                                <span className="text-xs font-black flex-1" style={{ color: TEAM_COLOR[b.team] }}>
                                  {TEAM_EMOJI[b.team]} {name(b.team)}
                                </span>
                                {i === 0 && pick?.team && (
                                  <span className="text-[9px] font-black bg-emerald-100 text-emerald-700
                                                   dark:bg-emerald-500/15 dark:text-emerald-300 rounded px-1.5 py-0.5">
                                    SOLD
                                  </span>
                                )}
                                <span className="text-xs font-black tabular-nums text-slate-900 dark:text-white">
                                  {formatPrice(b.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <p className="px-4 py-6 text-sm text-slate-400 text-center">No players match "{q}".</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2.5 text-center">
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5 truncate">{value}</p>
    </div>
  );
}

export default AuctionCentre;
