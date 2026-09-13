import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield, Crown, TrendingUp, TrendingDown, Users, CalendarDays, Info,
  ChevronDown, Trophy, Swords, Target,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { useMatches } from '../hooks/useMatches';
import { useMembers } from '../hooks/useMembers';
import { useCaptaincy, type CaptainRecord } from '../hooks/useCaptaincy';
import type { Match } from '../types';

// ─── Captaincy ────────────────────────────────────────────────────────────────
// Who has led SCC, and what happened when they did. Deliberately off the nav:
// a reference page, and a win-rate table of teammates is better found than
// pushed at everybody.
//
// Built from matches.captain_id — named on the fixture, or read from CricHeroes'
// own (c) marker by the scorecard sync. Nothing here to maintain.
//
// It is meant to be shown to the side, so it reads in that order: the club's
// record, then the four things people argue about, then each captain, then the
// matches themselves. Tapping a captain opens their detail AND filters the list
// below to them — one interaction, no modes to learn.

/** A captaincy record is only worth reading past this many matches. */
const SOLID = 10;

const fmtDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });

const firstName = (n: string | undefined) => (n ?? '—').split(' ')[0];

function ResultDot({ result, size = 'sm' }: { result: Match['result']; size?: 'sm' | 'xs' }) {
  const cls = result === 'won' ? 'bg-emerald-500'
    : result === 'lost' ? 'bg-rose-500'
    : 'bg-amber-500';
  const dim = size === 'sm' ? 'w-5 h-5' : 'w-4 h-4';
  return (
    <span className={`${dim} ${cls} rounded-full text-white t-micro font-black
                      flex items-center justify-center flex-shrink-0`}>
      {result === 'won' ? 'W' : result === 'lost' ? 'L' : 'D'}
    </span>
  );
}

function Face({ c }: { c: CaptainRecord }) {
  const name = c.member?.name ?? 'Unknown';
  return (
    <span className="w-11 h-11 r-card bg-sky-500/10 dark:bg-sky-400/15 ring-1 ring-sky-400/30
                     flex items-center justify-center flex-shrink-0 overflow-hidden">
      {c.member?.avatar_url
        ? <img src={c.member.avatar_url} alt="" className="w-full h-full object-cover" />
        : <span className="t-num text-lg text-sky-600 dark:text-sky-300">{name.charAt(0)}</span>}
    </span>
  );
}

/** Won / drawn / lost, at honest widths. */
function RecordBar({ c, className = '' }: { c: CaptainRecord; className?: string }) {
  return (
    <span className={`h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden flex ${className}`}>
      <span className="bg-emerald-500" style={{ flex: c.won || 0.0001 }} />
      <span className="bg-amber-500" style={{ flex: c.drawn || 0.0001 }} />
      <span className="bg-rose-500" style={{ flex: c.lost || 0.0001 }} />
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="t-num text-lg lg:text-xl leading-none text-slate-900 dark:text-white">{value}</p>
      <p className="t-micro font-black uppercase tracking-[1.5px] text-slate-400 dark:text-white/40 mt-1">
        {label}
      </p>
    </div>
  );
}

/** One of the four things people actually argue about. */
function Honour({ icon, label, name, value, sub }: {
  icon: React.ReactNode; label: string; name: string; value: string; sub?: string;
}) {
  return (
    <div className="glass r-card relative overflow-hidden p-4">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-amber-400/70" />
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-lg bg-amber-500/10 dark:bg-amber-400/15
                         flex items-center justify-center flex-shrink-0">{icon}</span>
        <span className="t-micro font-black uppercase tracking-[1.5px] text-slate-400 dark:text-white/45 truncate">
          {label}
        </span>
      </div>
      <p className="t-num text-2xl leading-none text-slate-900 dark:text-white mt-3">{value}</p>
      <p className="t-body font-bold text-slate-700 dark:text-white/80 mt-1 truncate">{name}</p>
      {sub && <p className="t-micro text-slate-400 dark:text-white/40 mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

function CaptainCard({ c, rank, open, selected, onToggle }: {
  c: CaptainRecord; rank: number; open: boolean; selected: boolean; onToggle: () => void;
}) {
  const name = c.member?.name ?? 'Unknown';
  const thin = c.led < SOLID;
  const medal = rank === 1 ? 'bg-amber-400 text-amber-950'
    : rank === 2 ? 'bg-slate-300 text-slate-800'
    : rank === 3 ? 'bg-orange-400 text-orange-950'
    : 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-white/40';

  return (
    <div className={`glass r-card relative overflow-hidden transition-all ${
      selected ? 'ring-2 ring-sky-400/70' : ''}`}>
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-sky-400 via-sky-300 to-transparent" />

      {/* The row IS the control: tap anywhere to open it and filter the list. */}
      <button onClick={onToggle} aria-expanded={open}
        className="w-full text-left p-4 lg:p-5 flex items-center gap-3">
        <span className={`w-6 h-6 rounded-full ${medal} t-micro font-black
                          flex items-center justify-center flex-shrink-0`}>{rank}</span>
        <Face c={c} />
        <span className="min-w-0 flex-1">
          <span className="font-display font-extrabold text-slate-900 dark:text-white text-base lg:text-lg
                           leading-tight truncate block">{name}</span>
          <span className="t-micro font-semibold text-slate-400 dark:text-white/45 block mt-0.5">
            {c.led} led · {c.won}W {c.lost}L{c.drawn ? ` ${c.drawn}D` : ''}
            {thin && <span className="text-amber-600 dark:text-amber-300"> · small sample</span>}
          </span>
          <RecordBar c={c} className="mt-2" />
        </span>
        <span className="text-right flex-shrink-0">
          <span className="t-num text-2xl leading-none text-slate-900 dark:text-white block">{c.winPct}%</span>
          <ChevronDown className={`w-4 h-4 text-slate-300 dark:text-white/30 ml-auto mt-1.5
                                   transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && (
        <div className="px-4 lg:px-5 pb-4 lg:pb-5">
          <div className="grid grid-cols-4 gap-2 pt-3 border-t border-slate-200/70 dark:border-white/10">
            <Stat label="Led" value={c.led} />
            <Stat label="Avg for" value={c.avgFor != null ? Math.round(c.avgFor) : '—'} />
            <Stat label="Avg vs" value={c.avgAgainst != null ? Math.round(c.avgAgainst) : '—'} />
            <Stat label="MOM" value={c.momWhileLeading} />
          </div>

          <div className="space-y-1.5 mt-4">
            {c.best && c.best.margin > 0 && (
              <p className="t-meta text-slate-500 dark:text-white/55 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                Best: <b className="text-slate-800 dark:text-white/90">+{c.best.margin}</b> v {c.best.opponent}
              </p>
            )}
            {c.worst && c.worst.margin < 0 && (
              <p className="t-meta text-slate-500 dark:text-white/55 flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 flex-shrink-0" />
                Heaviest: <b className="text-slate-800 dark:text-white/90">{c.worst.margin}</b> v {c.worst.opponent}
              </p>
            )}
            {c.usualDeputy?.member && (
              <p className="t-meta text-slate-500 dark:text-white/55 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                Usually with <b className="text-slate-800 dark:text-white/90">{c.usualDeputy.member.name}</b>
                {' '}({c.usualDeputy.count} of {c.led})
              </p>
            )}
            <p className="t-meta text-slate-500 dark:text-white/55 flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              {fmtDate(c.firstLed)} – {fmtDate(c.lastLed)}
            </p>
          </div>

          <div className="flex items-center gap-1.5 mt-4">
            {c.form.map((f, i) => <ResultDot key={i} result={f.result} size="xs" />)}
            <span className="t-micro text-slate-400 dark:text-white/35 ml-1">latest first</span>
          </div>

          {c.member && (
            <Link to={`/profile/${c.memberId}`}
              className="inline-block mt-4 t-meta font-black text-sky-600 dark:text-sky-300">
              Full profile →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

type SortKey = 'led' | 'win' | 'scored';

export function Captains() {
  const { matches } = useMatches();
  const { members } = useMembers();
  const data = useCaptaincy(matches, members);

  const [sort, setSort] = useState<SortKey>('led');
  const [openId, setOpenId] = useState<string | null>(null);

  const decided = data.ledWon + data.ledLost;
  const thin = data.captains.filter(c => c.led < SOLID);

  const ordered = useMemo(() => {
    const xs = [...data.captains];
    if (sort === 'win') {
      // Real samples first: a 100% from one match at the top of a win-rate
      // list is the kind of thing that ends friendships.
      return xs.sort((a, b) =>
        Number(b.led >= SOLID) - Number(a.led >= SOLID) || b.winPct - a.winPct || b.led - a.led);
    }
    if (sort === 'scored') return xs.sort((a, b) => (b.avgFor ?? 0) - (a.avgFor ?? 0));
    return xs.sort((a, b) => b.led - a.led || b.winPct - a.winPct);
  }, [data.captains, sort]);

  // The four things people argue about, decided by the record.
  const honours = useMemo(() => {
    const eligible = data.captains.filter(c => c.led >= SOLID);
    return {
      most: [...data.captains].sort((a, b) => b.led - a.led)[0],
      bestRate: [...eligible].sort((a, b) => b.winPct - a.winPct)[0],
      bigWin: data.captains.filter(c => c.best && c.best.margin > 0)
        .sort((a, b) => b.best!.margin - a.best!.margin)[0],
      mostMom: [...data.captains].sort((a, b) => b.momWhileLeading - a.momWhileLeading)[0],
    };
  }, [data.captains]);

  const shown = openId
    ? data.timeline.filter(t => t.match.captain_id === openId)
    : data.timeline;
  const selectedName = openId
    ? data.captains.find(c => c.memberId === openId)?.member?.name
    : null;

  return (
    <div>
      <Header title="Captaincy" subtitle="Who has led SCC, and how it went" />

      <div className="p-4 lg:p-8 space-y-4 max-w-4xl mx-auto">

        {/* ── The club under a named captain ───────────────────────────── */}
        <div className="glass r-card relative overflow-hidden p-5 lg:p-6">
          <div className="absolute inset-0 pointer-events-none"
               style={{ background: 'radial-gradient(620px circle at 88% -30%, rgba(56,189,248,0.16), transparent 62%)' }} />
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-sky-400 via-sky-300 to-transparent" />
          <div className="relative flex items-center gap-4">
            <span className="w-12 h-12 lg:w-14 lg:h-14 r-card bg-sky-400/15 ring-1 ring-sky-400/40
                             flex items-center justify-center flex-shrink-0">
              <Shield className="w-6 h-6 lg:w-7 lg:h-7 text-sky-600 dark:text-sky-300" />
            </span>
            <div className="min-w-0 flex-1">
              <span className="t-micro font-black uppercase tracking-[2px] text-sky-600 dark:text-sky-300">
                Under a named captain
              </span>
              <h2 className="font-display font-extrabold text-slate-900 dark:text-white text-xl lg:text-2xl leading-tight mt-0.5">
                {data.ledWon}–{data.ledLost} in {data.ledTotal} matches
              </h2>
              <p className="t-meta font-semibold text-slate-400 dark:text-white/45 mt-0.5">
                {data.captains.length} captain{data.captains.length === 1 ? '' : 's'}
                {data.since && <> · since {fmtDate(data.since)}</>}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="t-num text-3xl lg:text-4xl leading-none text-slate-900 dark:text-white">
                {decided ? Math.round((data.ledWon / decided) * 100) : 0}%
              </p>
              <p className="t-micro font-black uppercase tracking-[1.5px] text-sky-600 dark:text-sky-300/70 mt-1">
                won
              </p>
            </div>
          </div>
        </div>

        {/* ── The arguments, settled ───────────────────────────────────── */}
        {data.captains.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Honour icon={<Shield className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300" />}
              label="Most in charge" value={`${honours.most.led}`}
              name={firstName(honours.most.member?.name)} sub="matches led" />
            {honours.bestRate && (
              <Honour icon={<Trophy className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300" />}
                label="Best win rate" value={`${honours.bestRate.winPct}%`}
                name={firstName(honours.bestRate.member?.name)}
                sub={`${honours.bestRate.led} matches · ${SOLID}+ only`} />
            )}
            {honours.bigWin?.best && (
              <Honour icon={<Swords className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300" />}
                label="Biggest win" value={`+${honours.bigWin.best.margin}`}
                name={firstName(honours.bigWin.member?.name)}
                sub={`v ${honours.bigWin.best.opponent}`} />
            )}
            {honours.mostMom && honours.mostMom.momWhileLeading > 0 && (
              <Honour icon={<Target className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300" />}
                label="Led and delivered" value={`${honours.mostMom.momWhileLeading}`}
                name={firstName(honours.mostMom.member?.name)} sub="MOM while captain" />
            )}
          </div>
        )}

        {/* ── Sort ─────────────────────────────────────────────────────── */}
        {data.captains.length > 1 && (
          <div className="flex gap-1 p-1 r-control bg-slate-100 dark:bg-white/5">
            {([['led', 'Most matches'], ['win', 'Win rate'], ['scored', 'Runs scored']] as const)
              .map(([k, label]) => (
                <button key={k} onClick={() => setSort(k)}
                  className={`flex-1 py-2 r-control t-meta font-black transition-colors ${
                    sort === k
                      ? 'bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-white/50'}`}>
                  {label}
                </button>
              ))}
          </div>
        )}

        {/* ── The captains ─────────────────────────────────────────────── */}
        {data.captains.length > 0 ? (
          <div className="space-y-3">
            {ordered.map((c, i) => (
              <CaptainCard key={c.memberId} c={c} rank={i + 1}
                open={openId === c.memberId}
                selected={openId === c.memberId}
                onToggle={() => setOpenId(openId === c.memberId ? null : c.memberId)} />
            ))}
          </div>
        ) : (
          <div className="glass r-card p-8 text-center">
            <Crown className="w-6 h-6 text-slate-300 dark:text-white/20 mx-auto" />
            <p className="t-body font-bold text-slate-700 dark:text-white/80 mt-2">No captain recorded yet</p>
            <p className="t-meta text-slate-400 dark:text-white/45 mt-1">
              Name one when you schedule a match and this page fills itself in.
            </p>
          </div>
        )}

        {/* ── Match by match, following whoever is open ────────────────── */}
        {data.timeline.length > 0 && (
          <div className="glass r-card p-5">
            <div className="flex items-center justify-between mb-3 gap-2">
              <p className="t-micro font-black uppercase tracking-[1.5px] text-slate-400 dark:text-white/45
                            flex items-center gap-1.5 min-w-0">
                <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">
                  {selectedName ? `Under ${selectedName}` : 'Match by match'}
                </span>
              </p>
              {openId ? (
                <button onClick={() => setOpenId(null)}
                  className="t-micro font-black text-sky-600 dark:text-sky-300 flex-shrink-0">
                  Show all
                </button>
              ) : shown.length > 40 && (
                <span className="t-micro text-slate-300 dark:text-white/25 flex-shrink-0">
                  latest 40 of {shown.length}
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              {shown.slice(0, 40).map(({ match, captain }) => (
                <div key={match.id} className="flex items-center gap-2.5 py-1.5
                                               border-t border-slate-100 dark:border-white/5 first:border-0">
                  <ResultDot result={match.result} size="xs" />
                  <span className="t-meta text-slate-400 dark:text-white/40 w-16 flex-shrink-0 tabular-nums">
                    {fmtDate(match.date)}
                  </span>
                  <span className="t-body text-slate-700 dark:text-white/80 flex-1 min-w-0 truncate">
                    {match.opponent || 'Unknown'}
                  </span>
                  {(match.our_score || match.opponent_score) && (
                    <span className="t-micro text-slate-400 dark:text-white/35 tabular-nums hidden sm:block flex-shrink-0">
                      {match.our_score?.split(' ')[0] ?? '—'} · {match.opponent_score?.split(' ')[0] ?? '—'}
                    </span>
                  )}
                  {!openId && (
                    <span className="t-meta font-bold text-slate-500 dark:text-white/55 truncate max-w-[7rem] flex-shrink-0">
                      {firstName(captain?.name)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── What this counts ─────────────────────────────────────────── */}
        <div className="glass r-card p-4 flex gap-3">
          <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="t-body font-bold text-slate-800 dark:text-white/90">What this counts</p>
            <p className="t-meta text-slate-500 dark:text-white/55 mt-1 leading-relaxed">
              Captains come from the fixture where somebody named one, and from
              CricHeroes' own (c) marker on the scorecard everywhere else — back to{' '}
              {data.since ? fmtDate(data.since) : 'the first record'}.{' '}
              <b className="text-slate-700 dark:text-white/80">{data.unrecorded} matches</b> name
              nobody in either place and are left out, so these records are a large
              sample rather than a complete one.
              {thin.length > 0 && (
                <> Read {thin.map(c => firstName(c.member?.name)).join(', ')} as form rather
                than a verdict — under {SOLID} matches in charge, a win rate says as much
                about the opposition as the captain.</>
              )}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

export default Captains;
