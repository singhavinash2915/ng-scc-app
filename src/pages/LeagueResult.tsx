import { useMemo } from 'react';
import { Crown, Lock, Clock, ScrollText } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { VoteRace } from '../components/VoteRace';
import { useAuth } from '../context/AuthContext';
import { useMembers } from '../hooks/useMembers';
import { useMatches } from '../hooks/useMatches';
import { useAllScorecards } from '../hooks/useAllScorecards';
import { useMarketValue } from '../hooks/useMarketValue';
import { useLeagueResult } from '../hooks/useLeagueResult';
import { SEASON_NEW, LEAGUE_TEAM_NAMES } from '../config/season2';
import type { Member } from '../types';

// ─── SCC League — captain election result ──────────────────────────────────────
// The reveal. Admin-gated: this is the only screen in the app that shows vote
// counts or who backed whom, and it exists to be projected once voting closes.

function Face({ member, size = 44, ring }: { member?: Member; size?: number; ring?: string }) {
  return member?.avatar_url ? (
    <img src={member.avatar_url} alt="" className="rounded-full object-cover flex-shrink-0"
      style={{ width: size, height: size, border: ring ? `3px solid ${ring}` : undefined }} />
  ) : (
    <div className="rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-white font-black
                    flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4, border: ring ? `3px solid ${ring}` : undefined }}>
      {member?.name?.charAt(0) ?? '?'}
    </div>
  );
}

export function LeagueResult() {
  const { isAdmin } = useAuth();
  const { members } = useMembers();
  const { matches } = useMatches();
  const { scorecards } = useAllScorecards();

  const values = useMarketValue(matches, members, scorecards);
  const ratingById = useMemo(
    () => Object.fromEntries(values.map(v => [v.member.id, v.rating])) as Record<string, number>,
    [values],
  );

  const { candidates, valid, turnout, notVoted, discarded, exactTimes, loading, error } =
    useLeagueResult(SEASON_NEW, ratingById);

  const memberById = useMemo(
    () => Object.fromEntries(members.map(m => [m.id, m])) as Record<string, Member>,
    [members],
  );

  if (!isAdmin) {
    return (
      <div>
        <Header title="Election Result" subtitle="Admin only" />
        <div className="p-8 max-w-md mx-auto mt-12 text-center">
          <div className="rounded-3xl border border-slate-200 dark:border-white/10 p-8 bg-white dark:bg-white/5">
            <Lock className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <h2 className="text-lg font-black text-slate-900 dark:text-white">Sealed</h2>
            <p className="text-sm text-slate-500 dark:text-white/60 mt-1.5">
              The result is revealed by the admin. Nice try 😄
            </p>
          </div>
        </div>
      </div>
    );
  }

  const winners = candidates.slice(0, 2);
  const rest = candidates.slice(2);
  const maxVotes = candidates[0]?.votes || 1;
  const totalVotes = candidates.reduce((n, c) => n + c.votes, 0) || 1;
  const pct = (v: number) => Math.round((v / totalVotes) * 100);
  const SERIES = ['#2a78d6', '#eb6834'];

  return (
    <div className="min-h-screen lr-root">
      <style>{`
        .lr-root { --lr-1:#2a78d6; --lr-2:#eb6834; --lr-muted:#b8b6ae; --lr-grid:#e8e7e2; }
        @media (prefers-color-scheme: dark) {
          :root:where(:not([data-theme="light"])) .lr-root {
            --lr-1:#3987e5; --lr-2:#d95926; --lr-muted:#6b6a63; --lr-grid:#2c2b28; }
        }
        :root[data-theme="dark"] .lr-root {
          --lr-1:#3987e5; --lr-2:#d95926; --lr-muted:#6b6a63; --lr-grid:#2c2b28; }
        @media (prefers-reduced-motion: no-preference) {
          .lr-bar { transform-origin: left center; animation: lr-grow .8s cubic-bezier(.22,1,.36,1) both; }
          @keyframes lr-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
          .lr-rise { animation: lr-up .6s cubic-bezier(.22,1,.36,1) both; }
          @keyframes lr-up { from { opacity:0; transform: translateY(14px);} to {opacity:1; transform:none;} }
        }
      `}</style>

      <Header title="Captain Election" subtitle={`SCC League · Season ${SEASON_NEW}`} />

      <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-4">

        {error && (
          <div className="rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200
                          dark:border-amber-500/25 p-4">
            <p className="text-sm font-bold text-amber-800 dark:text-amber-200">Ballots are locked down</p>
            <p className="text-xs text-amber-700/80 dark:text-amber-200/70 mt-1">
              The database no longer serves ballot rows, so this page can't rebuild the result.
              Run <code>./scripts/league_votes.sh</code> or the Supabase SQL editor instead. ({error})
            </p>
          </div>
        )}

        {loading && <p className="text-sm text-slate-400">Counting…</p>}

        {!loading && candidates.length > 0 && (
          <>
            {/* ── THE CAPTAINS ─────────────────────────────────────────── */}
            <div className="lr-rise relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white shadow-2xl"
              style={{ background: 'radial-gradient(900px 400px at 80% -20%, #7c3aed 0%, transparent 55%), linear-gradient(140deg,#1e1b4b 5%,#4c1d95 45%,#9d174d 100%)' }}>
              <p className="text-center text-[10px] font-black uppercase tracking-[3px] text-white/70">
                Season {SEASON_NEW} · Your captains
              </p>

              <div className="grid grid-cols-2 gap-3 sm:gap-5 mt-5">
                {winners.map((c, i) => (
                  <div key={c.id} className="text-center lr-rise"
                    style={{ animationDelay: `${120 + i * 140}ms` }}>
                    <div className="flex justify-center">
                      <Face member={memberById[c.id]} size={92} ring={SERIES[i]} />
                    </div>
                    <div className="inline-flex items-center gap-1 mt-3 bg-white/15 border border-white/25
                                    rounded-full px-2.5 py-1">
                      <Crown className="w-3 h-3" fill="currentColor" />
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        {i === 0 ? LEAGUE_TEAM_NAMES.team1 : LEAGUE_TEAM_NAMES.team2}
                      </span>
                    </div>
                    <p className="font-display text-xl sm:text-2xl font-extrabold mt-2 leading-tight">
                      {memberById[c.id]?.name ?? '?'}
                    </p>
                    {/* hero figure: proportional digits, same sans as everything else */}
                    <p className="text-3xl font-extrabold mt-1" style={{ color: SERIES[i] }}>
                      {c.votes}
                    </p>
                    <p className="text-[11px] text-white/60 -mt-0.5">
                      vote{c.votes === 1 ? '' : 's'} · {pct(c.votes)}% of the ballot
                    </p>
                  </div>
                ))}
              </div>

              <p className="text-center text-white/70 text-xs mt-5 max-w-sm mx-auto">
                {LEAGUE_TEAM_NAMES.team1} &amp; {LEAGUE_TEAM_NAMES.team2} — they build their squads
                at the auction, and name their deputies after 🔨
              </p>
            </div>

            {/* ── TURNOUT ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { v: `${turnout.pct}%`, l: 'Turnout' },
                { v: `${turnout.voted}/${turnout.eligible}`, l: 'Ballots cast' },
                { v: candidates.length, l: 'Players backed' },
              ].map((s, i) => (
                <div key={s.l} className="lr-rise rounded-2xl bg-white dark:bg-white/5 border
                                border-slate-200 dark:border-white/10 p-4 text-center"
                  style={{ animationDelay: `${300 + i * 70}ms` }}>
                  <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{s.v}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">{s.l}</p>
                </div>
              ))}
            </div>

            {/* ── THE COUNT ────────────────────────────────────────────── */}
            <div className="rounded-3xl bg-white dark:bg-white/5 border border-slate-200
                            dark:border-white/10 p-5 sm:p-6">
              <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <ScrollText className="w-4 h-4 text-slate-400" /> The count
              </h2>
              <p className="text-xs text-slate-500 dark:text-white/60 mt-1 mb-4">
                Every player who received a vote, with their share of the {totalVotes} ballots.
                The top two take the captaincies.
              </p>

              <div className="space-y-2.5">
                {candidates.map((c, i) => {
                  const isWinner = i < 2;
                  const colour = isWinner ? SERIES[i] : 'var(--lr-muted)';
                  return (
                    <div key={c.id} className="flex items-center gap-3">
                      <span className="text-[11px] font-black w-4 text-right tabular-nums text-slate-400">
                        {i + 1}
                      </span>
                      <Face member={memberById[c.id]} size={28} />
                      <span className={`text-sm flex-1 truncate ${isWinner
                        ? 'font-black text-slate-900 dark:text-white'
                        : 'text-slate-600 dark:text-white/70'}`}>
                        {memberById[c.id]?.name ?? '?'}
                        {isWinner && <Crown className="w-3 h-3 inline ml-1 -mt-0.5 text-amber-500" fill="currentColor" />}
                      </span>
                      <div className="w-[42%] sm:w-[46%] flex items-center gap-2">
                        <div className="flex-1 h-2.5 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                          <div className="lr-bar h-full rounded-full"
                            style={{
                              width: `${(c.votes / maxVotes) * 100}%`,
                              background: colour,
                              animationDelay: `${i * 60}ms`,
                            }} />
                        </div>
                        <span className="text-xs font-black tabular-nums w-5 text-right
                                         text-slate-900 dark:text-white">{c.votes}</span>
                        <span className="text-[11px] font-bold tabular-nums w-9 text-right
                                         text-slate-400 dark:text-white/45">{pct(c.votes)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {rest.length > 0 && (
                <p className="text-[11px] text-slate-400 mt-3">
                  Grey bars didn't make the top two — no less appreciated 🙌
                </p>
              )}
            </div>

            {/* ── THE RACE ─────────────────────────────────────────────── */}
            <div className="rounded-3xl bg-white dark:bg-white/5 border border-slate-200
                            dark:border-white/10 p-5 sm:p-6">
              <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" /> How the lead changed
              </h2>
              <p className="text-xs text-slate-500 dark:text-white/60 mt-1 mb-3">
                Every ballot replayed in the order it landed. Press play and watch the bars swap.
              </p>

              {!exactTimes && (
                <div className="rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200
                                dark:border-amber-500/25 p-3.5 mb-4">
                  <p className="text-[11px] font-bold text-amber-800 dark:text-amber-200">
                    Approximate replay
                  </p>
                  <p className="text-[11px] text-amber-700/80 dark:text-amber-200/70 mt-1 leading-snug">
                    Changing a vote overwrote the old one and kept the original timestamp, so this
                    shows each player's <b>final</b> pick at the time they <b>first</b> voted. Anyone
                    who briefly led on votes that later moved elsewhere won't appear — that history
                    was never stored. Run <code>add_league_vote_history.sql</code> to record it
                    properly from the next election.
                  </p>
                </div>
              )}

              {/* identity is never colour-alone: the legend names the two winners */}
              <div className="flex flex-wrap gap-3 mb-4">
                {winners.map((c, i) => (
                  <span key={c.id} className="inline-flex items-center gap-1.5 text-[11px] font-bold
                                              text-slate-600 dark:text-white/70">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: SERIES[i] }} />
                    {memberById[c.id]?.name?.split(' ')[0]} · captain
                  </span>
                ))}
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold
                                 text-slate-600 dark:text-white/70">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#b8b6ae' }} />
                  everyone else
                </span>
              </div>

              <VoteRace ballots={valid} candidates={candidates} memberById={memberById} />
            </div>

            {/* ── FOOTNOTES ────────────────────────────────────────────── */}
            {(notVoted.length > 0 || discarded.length > 0) && (
              <div className="rounded-3xl bg-slate-50 dark:bg-white/5 border border-slate-200
                              dark:border-white/10 p-5 text-xs space-y-2">
                {notVoted.length > 0 && (
                  <p className="text-slate-500 dark:text-white/60">
                    <b className="text-slate-700 dark:text-white/80">Didn't vote:</b>{' '}
                    {notVoted.map(id => memberById[id]?.name ?? '?').join(', ')}
                  </p>
                )}
                {discarded.length > 0 && (
                  <p className="text-slate-500 dark:text-white/60">
                    <b className="text-slate-700 dark:text-white/80">Not counted:</b>{' '}
                    {discarded.length} ballot{discarded.length === 1 ? '' : 's'} from
                    {discarded.length === 1 ? ' a player' : ' players'} registered as sitting out.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default LeagueResult;
