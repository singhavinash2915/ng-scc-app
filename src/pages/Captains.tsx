import { Link } from 'react-router-dom';
import { Shield, Crown, TrendingUp, TrendingDown, Users, CalendarDays, Info } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { useMatches } from '../hooks/useMatches';
import { useMembers } from '../hooks/useMembers';
import { useCaptaincy, type CaptainRecord } from '../hooks/useCaptaincy';
import type { Match } from '../types';

// ─── Captaincy ────────────────────────────────────────────────────────────────
// Who has led SCC, and what happened when they did. Deliberately off the nav:
// it is a reference page, not somewhere anyone needs to pass every week, and a
// win-rate table of teammates is better found than pushed.
//
// Built entirely from matches.captain_id, so it costs nothing to keep: name a
// captain when the fixture is scheduled and this fills itself in.

const fmtDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });

function ResultDot({ result }: { result: Match['result'] }) {
  const cls = result === 'won' ? 'bg-emerald-500'
    : result === 'lost' ? 'bg-rose-500'
    : 'bg-amber-500';
  const ch = result === 'won' ? 'W' : result === 'lost' ? 'L' : 'D';
  return (
    <span className={`w-5 h-5 rounded-full ${cls} text-white t-micro font-black
                      flex items-center justify-center flex-shrink-0`}>{ch}</span>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div>
      <p className="t-num text-lg lg:text-xl leading-none text-slate-900 dark:text-white">{value}</p>
      <p className="t-micro font-black uppercase tracking-[1.5px] text-slate-400 dark:text-white/40 mt-1">
        {label}
      </p>
      {sub && <p className="t-micro text-slate-400 dark:text-white/35 mt-0.5">{sub}</p>}
    </div>
  );
}

function CaptainCard({ c, rank }: { c: CaptainRecord; rank: number }) {
  const name = c.member?.name ?? 'Unknown';
  return (
    <div className="glass r-card relative overflow-hidden p-5">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-sky-400 via-sky-300 to-transparent" />

      <div className="flex items-center gap-3">
        <span className="w-11 h-11 r-card bg-sky-500/10 dark:bg-sky-400/15 ring-1 ring-sky-400/30
                         flex items-center justify-center flex-shrink-0 overflow-hidden">
          {c.member?.avatar_url
            ? <img src={c.member.avatar_url} alt="" className="w-full h-full object-cover" />
            : <span className="t-num text-lg text-sky-600 dark:text-sky-300">{name.charAt(0)}</span>}
        </span>
        <div className="min-w-0 flex-1">
          {c.member
            ? <Link to={`/profile/${c.memberId}`}
                className="font-display font-extrabold text-slate-900 dark:text-white text-lg leading-tight truncate block">
                {name}
              </Link>
            : <p className="font-display font-extrabold text-slate-900 dark:text-white text-lg truncate">{name}</p>}
          <p className="t-micro font-semibold text-slate-400 dark:text-white/45 mt-0.5">
            {fmtDate(c.firstLed)} – {fmtDate(c.lastLed)}
            {c.momWhileLeading > 0 && (
              <span className="text-amber-600 dark:text-amber-300">
                {' · '}{c.momWhileLeading} MOM while leading
              </span>
            )}
          </p>
        </div>
        <span className="t-micro font-black text-slate-300 dark:text-white/25 flex-shrink-0">#{rank}</span>
      </div>

      {/* The record */}
      <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-slate-200/70 dark:border-white/10">
        <Stat label="Led" value={c.led} />
        <Stat label="Won" value={c.won} />
        <Stat label="Lost" value={c.lost} />
        <Stat label="Win %" value={`${c.winPct}%`} />
      </div>

      {/* Win rate as a bar — the one number people look for, given honest width */}
      <div className="mt-3 h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden flex">
        <div className="bg-emerald-500" style={{ flex: c.won || 0.0001 }} />
        <div className="bg-amber-500" style={{ flex: c.drawn || 0.0001 }} />
        <div className="bg-rose-500" style={{ flex: c.lost || 0.0001 }} />
      </div>

      {/* Scoring under them */}
      {(c.avgFor != null || c.avgAgainst != null) && (
        <div className="grid grid-cols-2 gap-2 mt-4">
          {c.avgFor != null && (
            <Stat label="Avg scored" value={Math.round(c.avgFor)} />
          )}
          {c.avgAgainst != null && (
            <Stat label="Avg conceded" value={Math.round(c.avgAgainst)} />
          )}
        </div>
      )}

      {/* Their best day and their worst */}
      <div className="space-y-1.5 mt-4 pt-3 border-t border-slate-200/70 dark:border-white/10">
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
      </div>

      {/* Form under their captaincy, newest first */}
      <div className="flex items-center gap-1.5 mt-4">
        {c.form.map((f, i) => <ResultDot key={i} result={f.result} />)}
        <span className="t-micro text-slate-400 dark:text-white/35 ml-1">latest first</span>
      </div>
    </div>
  );
}

export function Captains() {
  const { matches } = useMatches();
  const { members } = useMembers();
  const data = useCaptaincy(matches, members);

  const mostExperienced = data.captains[0];
  const decided = data.ledWon + data.ledLost;

  return (
    <div>
      <Header title="Captaincy" subtitle="Who has led SCC, and how it went" />

      <div className="p-4 lg:p-8 space-y-4 max-w-4xl mx-auto">

        {/* ── The club's record under a named captain ──────────────────── */}
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

        {/* ── What this page can and cannot say ────────────────────────────
            Stated up front rather than in a footnote. Four captains over two
            dozen matches is form, not evidence, and a page that ranks
            teammates by win rate owes the reader that. */}
        <div className="glass r-card p-4 flex gap-3">
          <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="t-body font-bold text-slate-800 dark:text-white/90">Read these as form, not verdicts</p>
            <p className="t-meta text-slate-500 dark:text-white/55 mt-1 leading-relaxed">
              The club only started recording a captain on the fixture in
              {data.since ? ` ${fmtDate(data.since)}` : ' 2026'}, so{' '}
              <b className="text-slate-700 dark:text-white/80">{data.unrecorded} earlier matches</b> have
              nobody named and are not counted here. Nobody has led more than{' '}
              {mostExperienced?.led ?? 0} matches — over a run that short, a win rate says
              as much about the opposition and the XI as it does about the captain.
            </p>
          </div>
        </div>

        {/* ── The captains ─────────────────────────────────────────────── */}
        {data.captains.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {data.captains.map((c, i) => <CaptainCard key={c.memberId} c={c} rank={i + 1} />)}
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

        {/* ── Who was in charge, match by match ────────────────────────── */}
        {data.timeline.length > 0 && (
          <div className="glass r-card p-5">
            <p className="t-micro font-black uppercase tracking-[1.5px] text-slate-400 dark:text-white/45
                          mb-3 flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" /> Match by match
            </p>
            <div className="space-y-1.5">
              {data.timeline.map(({ match, captain }) => (
                <div key={match.id} className="flex items-center gap-2.5 py-1.5
                                               border-t border-slate-100 dark:border-white/5 first:border-0">
                  <ResultDot result={match.result} />
                  <span className="t-meta text-slate-400 dark:text-white/40 w-16 flex-shrink-0 tabular-nums">
                    {fmtDate(match.date)}
                  </span>
                  <span className="t-body text-slate-700 dark:text-white/80 flex-1 min-w-0 truncate">
                    {match.opponent || 'Unknown'}
                  </span>
                  <span className="t-meta font-bold text-slate-500 dark:text-white/55 truncate max-w-[9rem]">
                    {captain?.name.split(' ')[0] ?? '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default Captains;
