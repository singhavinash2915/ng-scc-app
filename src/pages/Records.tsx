import { useMemo } from 'react';
import {
  Trophy, Crown, Award, Zap, Shield, TrendingUp, TrendingDown,
  Flame, Star,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { useMatches } from '../hooks/useMatches';
import { useCricketStats } from '../hooks/useCricketStats';
import { useMOMCounts } from '../hooks/useMOMCounts';
import type { Match, MemberCricketStats } from '../types';

// Parse "120/9 (15.0 Ov)" → { runs: 120, wkts: 9 }
function parseScore(s: string | null): { runs: number; wkts: number } | null {
  if (!s) return null;
  const m = s.match(/(\d+)\/(\d+)/);
  if (!m) {
    const justRuns = s.match(/(\d+)/);
    if (justRuns) return { runs: parseInt(justRuns[1]), wkts: 0 };
    return null;
  }
  return { runs: parseInt(m[1]), wkts: parseInt(m[2]) };
}

// Parse "5/14" bowling figures → { wkts: 5, runs: 14 }
function parseBowling(s: string | null): { wkts: number; runs: number } | null {
  if (!s) return null;
  const m = s.match(/(\d+)\/(\d+)/);
  if (!m) return null;
  return { wkts: parseInt(m[1]), runs: parseInt(m[2]) };
}

interface RecordCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | React.ReactNode;
  subtitle?: string | React.ReactNode;
  gradient: string;
  border: string;
}

function RecordCard({ icon, label, value, subtitle, gradient, border }: RecordCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-5 min-h-[140px] flex flex-col"
         style={{ background: gradient }}>
      <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ border }} />
      <div className="flex items-center gap-1.5 mb-2 relative">
        {icon}
        <span className="text-white/70 text-[10px] font-bold uppercase tracking-[1.5px]">{label}</span>
      </div>
      <div className="flex-1 flex flex-col justify-center relative">
        <div className="text-2xl lg:text-3xl font-black text-white tabular-nums leading-tight">{value}</div>
        {subtitle && (
          <div className="text-xs text-white/60 mt-1 truncate">{subtitle}</div>
        )}
      </div>
    </div>
  );
}

export function Records() {
  const { matches } = useMatches();
  const { stats } = useCricketStats('2025-26');
  const { counts: momCounts } = useMOMCounts();

  // ── Team records (from matches table) ────────────────────────────────────
  const teamRecords = useMemo(() => {
    const ext = matches.filter(m => m.match_type === 'external' && ['won', 'lost', 'draw'].includes(m.result));
    let highestScore: { match: Match; runs: number } | null = null;
    let lowestScore: { match: Match; runs: number } | null = null;
    let biggestWin: { match: Match; margin: string; marginRuns: number } | null = null;
    let biggestLoss: { match: Match; margin: string; marginRuns: number } | null = null;

    for (const m of ext) {
      const ours = parseScore(m.our_score);
      const theirs = parseScore(m.opponent_score);
      if (!ours) continue;

      if (!highestScore || ours.runs > highestScore.runs) {
        highestScore = { match: m, runs: ours.runs };
      }
      if (ours.wkts === 10 && (!lowestScore || ours.runs < lowestScore.runs)) {
        lowestScore = { match: m, runs: ours.runs };
      }

      if (theirs) {
        if (m.result === 'won' && (!biggestWin || (ours.runs - theirs.runs) > biggestWin.marginRuns)) {
          const diff = ours.runs - theirs.runs;
          if (diff > 0) {
            biggestWin = { match: m, margin: `by ${diff} runs`, marginRuns: diff };
          }
        }
        if (m.result === 'lost' && (!biggestLoss || (theirs.runs - ours.runs) > biggestLoss.marginRuns)) {
          const diff = theirs.runs - ours.runs;
          if (diff > 0) {
            biggestLoss = { match: m, margin: `by ${diff} runs`, marginRuns: diff };
          }
        }
      }
    }

    // Longest streak (any result)
    const sorted = [...ext].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let longestWin = 0, longestLoss = 0, curWin = 0, curLoss = 0;
    let longestWinEnd: Match | null = null, longestLossEnd: Match | null = null;
    for (const m of sorted) {
      if (m.result === 'won') {
        curWin++; curLoss = 0;
        if (curWin > longestWin) { longestWin = curWin; longestWinEnd = m; }
      } else if (m.result === 'lost') {
        curLoss++; curWin = 0;
        if (curLoss > longestLoss) { longestLoss = curLoss; longestLossEnd = m; }
      } else {
        curWin = 0; curLoss = 0;
      }
    }

    return {
      total: ext.length,
      won: ext.filter(m => m.result === 'won').length,
      lost: ext.filter(m => m.result === 'lost').length,
      drawn: ext.filter(m => m.result === 'draw').length,
      highestScore, lowestScore, biggestWin, biggestLoss,
      longestWin, longestLoss, longestWinEnd, longestLossEnd,
    };
  }, [matches]);

  // ── Individual records (from cricket stats) ──────────────────────────────
  const playerRecords = useMemo(() => {
    if (!stats.length) return null;

    const getName = (s: MemberCricketStats) => (s.member as { name?: string } | undefined)?.name || '—';
    const getAvatar = (s: MemberCricketStats) => (s.member as { avatar_url?: string } | undefined)?.avatar_url;

    const topRuns = [...stats].sort((a, b) => b.batting_runs - a.batting_runs)[0];
    const topAvg = [...stats].filter(s => s.batting_innings >= 5).sort((a, b) => b.batting_average - a.batting_average)[0];
    const highestIndividual = [...stats].sort((a, b) => (b.batting_highest_score || 0) - (a.batting_highest_score || 0))[0];
    const topWkts = [...stats].sort((a, b) => b.bowling_wickets - a.bowling_wickets)[0];
    const bestBowling = [...stats]
      .map(s => ({ s, parsed: parseBowling(s.bowling_best_figures) }))
      .filter(x => x.parsed)
      .sort((a, b) => {
        if (a.parsed!.wkts !== b.parsed!.wkts) return b.parsed!.wkts - a.parsed!.wkts;
        return a.parsed!.runs - b.parsed!.runs;
      })[0];
    const topCatches = [...stats].sort((a, b) => b.fielding_catches - a.fielding_catches)[0];
    const topMOMs = Object.entries(momCounts).map(([id, c]) => ({ id, count: c }))
      .sort((a, b) => b.count - a.count)[0];

    return { topRuns, topAvg, highestIndividual, topWkts, bestBowling, topCatches, topMOMs, getName, getAvatar };
  }, [stats, momCounts]);

  return (
    <div>
      <Header title="Club Records" subtitle="Hall of fame · Season 2025–26" />

      <div className="p-4 lg:p-8 space-y-6">

        {/* ── Header banner ─────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl p-6 lg:p-7 shadow-2xl"
             style={{ background: 'radial-gradient(600px circle at 0% 0%, rgba(251,191,36,0.3), transparent 50%), linear-gradient(135deg, #78350f 0%, #1a0f05 60%, #0a1019 100%)' }}>
          <div className="absolute inset-0 border border-amber-500/30 rounded-2xl pointer-events-none" />
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-amber-400/15 rounded-full blur-3xl" />
          <div className="absolute top-4 right-8 text-7xl opacity-[0.06] select-none pointer-events-none">🏆</div>
          <div className="relative flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-400/20 border-2 border-amber-400/40 flex items-center justify-center flex-shrink-0">
              <Trophy className="w-7 h-7 text-amber-300" />
            </div>
            <div>
              <h2 className="text-2xl lg:text-3xl font-black text-white">Hall of Fame</h2>
              <p className="text-amber-200/60 text-sm mt-0.5">{teamRecords.total} matches · {teamRecords.won}W · {teamRecords.lost}L · {teamRecords.drawn}D</p>
            </div>
          </div>
        </div>

        {/* ── TEAM RECORDS ─────────────────────────────────────────────── */}
        <div>
          <h3 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[2px] mb-3 flex items-center gap-2">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            Team Records
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {teamRecords.highestScore && (
              <RecordCard
                icon={<TrendingUp className="w-3.5 h-3.5 text-emerald-300" />}
                label="Highest Total"
                value={`${teamRecords.highestScore.runs}`}
                subtitle={`${teamRecords.highestScore.match.our_score} vs ${teamRecords.highestScore.match.opponent}`}
                gradient="linear-gradient(135deg, #065f46 0%, #0a1019 100%)"
                border="1px solid rgba(16,185,129,0.3)"
              />
            )}
            {teamRecords.lowestScore && (
              <RecordCard
                icon={<TrendingDown className="w-3.5 h-3.5 text-red-300" />}
                label="Lowest All-out"
                value={`${teamRecords.lowestScore.runs}`}
                subtitle={`${teamRecords.lowestScore.match.our_score} vs ${teamRecords.lowestScore.match.opponent}`}
                gradient="linear-gradient(135deg, #7f1d1d 0%, #0a1019 100%)"
                border="1px solid rgba(239,68,68,0.3)"
              />
            )}
            {teamRecords.biggestWin && (
              <RecordCard
                icon={<Trophy className="w-3.5 h-3.5 text-amber-300" />}
                label="Biggest Victory"
                value={teamRecords.biggestWin.margin}
                subtitle={`vs ${teamRecords.biggestWin.match.opponent} · ${teamRecords.biggestWin.match.our_score?.split(' ')[0]} – ${teamRecords.biggestWin.match.opponent_score?.split(' ')[0]}`}
                gradient="linear-gradient(135deg, #78350f 0%, #0a1019 100%)"
                border="1px solid rgba(251,191,36,0.3)"
              />
            )}
            {teamRecords.biggestLoss && (
              <RecordCard
                icon={<Shield className="w-3.5 h-3.5 text-orange-300" />}
                label="Biggest Defeat"
                value={teamRecords.biggestLoss.margin}
                subtitle={`vs ${teamRecords.biggestLoss.match.opponent} · ${teamRecords.biggestLoss.match.our_score?.split(' ')[0]} – ${teamRecords.biggestLoss.match.opponent_score?.split(' ')[0]}`}
                gradient="linear-gradient(135deg, #7c2d12 0%, #0a1019 100%)"
                border="1px solid rgba(249,115,22,0.3)"
              />
            )}
            {teamRecords.longestWin > 1 && (
              <RecordCard
                icon={<Flame className="w-3.5 h-3.5 text-emerald-300" />}
                label="Longest Win Streak"
                value={`${teamRecords.longestWin} matches`}
                subtitle={teamRecords.longestWinEnd ? `last: vs ${teamRecords.longestWinEnd.opponent}` : ''}
                gradient="linear-gradient(135deg, #14532d 0%, #0a1019 100%)"
                border="1px solid rgba(34,197,94,0.3)"
              />
            )}
            {teamRecords.longestLoss > 1 && (
              <RecordCard
                icon={<TrendingDown className="w-3.5 h-3.5 text-red-300" />}
                label="Longest Losing Run"
                value={`${teamRecords.longestLoss} matches`}
                subtitle={teamRecords.longestLossEnd ? `last: vs ${teamRecords.longestLossEnd.opponent}` : ''}
                gradient="linear-gradient(135deg, #7f1d1d 0%, #0a1019 100%)"
                border="1px solid rgba(239,68,68,0.3)"
              />
            )}
          </div>
        </div>

        {/* ── INDIVIDUAL RECORDS ──────────────────────────────────────── */}
        {playerRecords && (
          <div>
            <h3 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[2px] mb-3 flex items-center gap-2">
              <Star className="w-3.5 h-3.5 text-amber-400" fill="currentColor" />
              Individual Records · Season 2025–26
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {playerRecords.topRuns && (
                <RecordCard
                  icon={<TrendingUp className="w-3.5 h-3.5 text-blue-300" />}
                  label="Most Runs"
                  value={`${playerRecords.topRuns.batting_runs}`}
                  subtitle={`${playerRecords.getName(playerRecords.topRuns)} · Avg ${playerRecords.topRuns.batting_average.toFixed(1)}`}
                  gradient="linear-gradient(135deg, #1e3a8a 0%, #0a1019 100%)"
                  border="1px solid rgba(59,130,246,0.3)"
                />
              )}
              {playerRecords.highestIndividual && (
                <RecordCard
                  icon={<Award className="w-3.5 h-3.5 text-violet-300" />}
                  label="Highest Score"
                  value={playerRecords.highestIndividual.batting_highest_score || '—'}
                  subtitle={playerRecords.getName(playerRecords.highestIndividual)}
                  gradient="linear-gradient(135deg, #4c1d95 0%, #0a1019 100%)"
                  border="1px solid rgba(139,92,246,0.3)"
                />
              )}
              {playerRecords.topAvg && (
                <RecordCard
                  icon={<Star className="w-3.5 h-3.5 text-cyan-300" fill="currentColor" />}
                  label="Best Average"
                  value={playerRecords.topAvg.batting_average.toFixed(1)}
                  subtitle={`${playerRecords.getName(playerRecords.topAvg)} · ${playerRecords.topAvg.batting_innings} inns`}
                  gradient="linear-gradient(135deg, #155e75 0%, #0a1019 100%)"
                  border="1px solid rgba(6,182,212,0.3)"
                />
              )}
              {playerRecords.topWkts && (
                <RecordCard
                  icon={<Zap className="w-3.5 h-3.5 text-red-300" fill="currentColor" />}
                  label="Most Wickets"
                  value={`${playerRecords.topWkts.bowling_wickets}`}
                  subtitle={`${playerRecords.getName(playerRecords.topWkts)} · Eco ${playerRecords.topWkts.bowling_economy.toFixed(2)}`}
                  gradient="linear-gradient(135deg, #7f1d1d 0%, #0a1019 100%)"
                  border="1px solid rgba(239,68,68,0.3)"
                />
              )}
              {playerRecords.bestBowling && (
                <RecordCard
                  icon={<Award className="w-3.5 h-3.5 text-rose-300" />}
                  label="Best Bowling"
                  value={playerRecords.bestBowling.s.bowling_best_figures || '—'}
                  subtitle={playerRecords.getName(playerRecords.bestBowling.s)}
                  gradient="linear-gradient(135deg, #881337 0%, #0a1019 100%)"
                  border="1px solid rgba(244,63,94,0.3)"
                />
              )}
              {playerRecords.topCatches && (
                <RecordCard
                  icon={<Shield className="w-3.5 h-3.5 text-emerald-300" />}
                  label="Most Catches"
                  value={`${playerRecords.topCatches.fielding_catches}`}
                  subtitle={playerRecords.getName(playerRecords.topCatches)}
                  gradient="linear-gradient(135deg, #065f46 0%, #0a1019 100%)"
                  border="1px solid rgba(16,185,129,0.3)"
                />
              )}
              {playerRecords.topMOMs && (() => {
                const m = stats.find(s => s.member_id === playerRecords.topMOMs!.id);
                return m ? (
                  <RecordCard
                    icon={<Crown className="w-3.5 h-3.5 text-amber-300" fill="currentColor" />}
                    label="Most MOM Awards"
                    value={`${playerRecords.topMOMs.count}`}
                    subtitle={playerRecords.getName(m)}
                    gradient="linear-gradient(135deg, #78350f 0%, #0a1019 100%)"
                    border="1px solid rgba(251,191,36,0.3)"
                  />
                ) : null;
              })()}
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center pt-4">
          Records derived from match results & CricHeroes-synced player stats · Season 2025–26
        </p>
      </div>
    </div>
  );
}

export default Records;
