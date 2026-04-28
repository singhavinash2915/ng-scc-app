import { useMemo, useState } from 'react';
import {
  Trophy, Crown, Award, Zap, Shield, TrendingUp, TrendingDown,
  Flame, Star, Sword, CalendarDays, Plus, X, Trash2,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { useMatches } from '../hooks/useMatches';
import { useMembers } from '../hooks/useMembers';
import { useCricketStats } from '../hooks/useCricketStats';
import { useMOMCounts } from '../hooks/useMOMCounts';
import { useHeadToHead } from '../hooks/useHeadToHead';
import { useCustomAwards } from '../hooks/useCustomAwards';
import { usePlayerOfPeriod } from '../hooks/usePlayerOfPeriod';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/ui/Modal';
import { Input, Select } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { ConfirmModal } from '../components/ui/ConfirmModal';
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
  const { members } = useMembers();
  const { stats } = useCricketStats('2025-26');
  const { counts: momCounts } = useMOMCounts();
  const { isAdmin } = useAuth();
  const { awards, addAward, deleteAward } = useCustomAwards();
  const h2h = useHeadToHead(matches);
  const { playerOfMonth, playerOfWeek, monthlyHistory } = usePlayerOfPeriod(matches, members, stats);

  const [showAwardModal, setShowAwardModal] = useState(false);
  const [confirmDelAward, setConfirmDelAward] = useState<string | null>(null);
  const [submittingAward, setSubmittingAward] = useState(false);
  const [awardForm, setAwardForm] = useState({
    member_id: '', award_name: '', description: '', icon: '🌟',
  });


  const handleAddAward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!awardForm.member_id || !awardForm.award_name.trim()) return;
    setSubmittingAward(true);
    try {
      await addAward({
        member_id: awardForm.member_id,
        award_name: awardForm.award_name.trim(),
        description: awardForm.description.trim() || null,
        season: '2025-26',
        icon: awardForm.icon || null,
        awarded_at: new Date().toISOString().split('T')[0],
      });
      setAwardForm({ member_id: '', award_name: '', description: '', icon: '🌟' });
      setShowAwardModal(false);
    } finally {
      setSubmittingAward(false);
    }
  };

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

        {/* ── PLAYERS OF THE WEEK + MONTH (side by side) ─────────────── */}
        {(playerOfWeek || playerOfMonth) && (
          <div>
            <h3 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[2px] mb-3 flex items-center gap-2">
              <CalendarDays className="w-3.5 h-3.5 text-amber-400" />
              Players in Form
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Player of the Week */}
              {playerOfWeek && (
                <div className="relative overflow-hidden rounded-2xl p-5 lg:p-6 shadow-xl"
                     style={{ background: 'radial-gradient(400px circle at 0% 0%, rgba(244,114,182,0.3), transparent 50%), linear-gradient(135deg, #831843 0%, #1a0510 60%, #0a1019 100%)' }}>
                  <div className="absolute inset-0 border border-pink-500/30 rounded-2xl pointer-events-none" />
                  <div className="absolute -top-12 -right-12 w-44 h-44 bg-pink-400/15 rounded-full blur-3xl" />
                  <div className="relative flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <Crown className="w-3.5 h-3.5 text-pink-300" fill="currentColor" />
                      <span className="text-pink-300/80 text-[10px] font-bold uppercase tracking-[1.5px]">Player of the Week</span>
                    </div>
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-pink-400/15 border border-pink-400/30 text-pink-200 text-[10px] font-black">
                      <Crown className="w-2.5 h-2.5" fill="currentColor" />
                      {playerOfWeek.moms}
                    </span>
                  </div>
                  <div className="relative flex items-center gap-4">
                    {playerOfWeek.member.avatar_url ? (
                      <img src={playerOfWeek.member.avatar_url} alt=""
                           className="w-16 h-16 lg:w-20 lg:h-20 rounded-2xl object-cover border-2 border-pink-400/40 shadow-xl shadow-pink-500/30 flex-shrink-0" />
                    ) : (
                      <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-2xl bg-gradient-to-br from-pink-400 to-rose-600 border-2 border-pink-400/40 flex items-center justify-center flex-shrink-0 shadow-xl shadow-pink-500/30">
                        <span className="text-2xl font-black text-pink-950">{playerOfWeek.member.name.charAt(0)}</span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xl lg:text-2xl font-black text-white truncate">{playerOfWeek.member.name}</h3>
                      <p className="text-pink-200/60 text-xs mt-0.5">{playerOfWeek.matchesPlayedInPeriod} match{playerOfWeek.matchesPlayedInPeriod !== 1 ? 'es' : ''} · last 7 days</p>
                      {playerOfWeek.tieBroken && (
                        <p className="text-pink-300/40 text-[10px] mt-1">tie-broken by season MVP score</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Player of the Month */}
              {playerOfMonth && (
                <div className="relative overflow-hidden rounded-2xl p-5 lg:p-6 shadow-xl"
                     style={{ background: 'radial-gradient(400px circle at 0% 0%, rgba(251,191,36,0.25), transparent 50%), linear-gradient(135deg, #78350f 0%, #1a0f05 60%, #0a1019 100%)' }}>
                  <div className="absolute inset-0 border border-amber-500/30 rounded-2xl pointer-events-none" />
                  <div className="absolute -top-12 -right-12 w-44 h-44 bg-amber-400/15 rounded-full blur-3xl" />
                  <div className="relative flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <Crown className="w-3.5 h-3.5 text-amber-300" fill="currentColor" />
                      <span className="text-amber-300/80 text-[10px] font-bold uppercase tracking-[1.5px]">Player of the Month</span>
                    </div>
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-200 text-[10px] font-black">
                      <Crown className="w-2.5 h-2.5" fill="currentColor" />
                      {playerOfMonth.moms}
                    </span>
                  </div>
                  <div className="relative flex items-center gap-4">
                    {playerOfMonth.member.avatar_url ? (
                      <img src={playerOfMonth.member.avatar_url} alt=""
                           className="w-16 h-16 lg:w-20 lg:h-20 rounded-2xl object-cover border-2 border-amber-400/50 shadow-xl shadow-amber-500/30 flex-shrink-0" />
                    ) : (
                      <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 border-2 border-amber-400/50 flex items-center justify-center flex-shrink-0 shadow-xl shadow-amber-500/30">
                        <span className="text-2xl font-black text-yellow-950">{playerOfMonth.member.name.charAt(0)}</span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xl lg:text-2xl font-black text-white truncate">{playerOfMonth.member.name}</h3>
                      <p className="text-amber-200/60 text-xs mt-0.5">{playerOfMonth.matchesPlayedInPeriod} match{playerOfMonth.matchesPlayedInPeriod !== 1 ? 'es' : ''} · {playerOfMonth.periodLabel}</p>
                      {playerOfMonth.tieBroken && (
                        <p className="text-amber-300/40 text-[10px] mt-1">tie-broken by season MVP score</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 6-month history timeline */}
            {monthlyHistory.some(m => m.winner) && (
              <div className="mt-4 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[1.5px] mb-3 flex items-center gap-1.5">
                  <Crown className="w-3 h-3 text-amber-400" fill="currentColor" />
                  Last 6 Months · Player of the Month
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {monthlyHistory.map(h => (
                    <div key={h.month}
                         className="rounded-xl border border-gray-100 dark:border-gray-800 p-2.5 text-center hover:border-amber-300 dark:hover:border-amber-700 transition-colors">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{h.monthLabel}</p>
                      {h.winner ? (
                        <>
                          {h.winner.member.avatar_url ? (
                            <img src={h.winner.member.avatar_url} alt=""
                                 className="w-9 h-9 rounded-full mx-auto mt-2 object-cover border border-amber-300 dark:border-amber-700" />
                          ) : (
                            <div className="w-9 h-9 rounded-full mx-auto mt-2 bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center">
                              <span className="text-xs font-black text-yellow-950">{h.winner.member.name.charAt(0)}</span>
                            </div>
                          )}
                          <p className="text-[11px] font-bold text-gray-800 dark:text-gray-200 mt-1.5 truncate">{h.winner.member.name.split(' ')[0]}</p>
                          <p className="text-[9px] text-amber-600 dark:text-amber-400 font-semibold">👑 {h.winner.moms}</p>
                        </>
                      ) : (
                        <div className="mt-2 text-[10px] text-gray-300 dark:text-gray-600 italic py-3">—</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── HEAD-TO-HEAD vs every opponent ──────────────────────────── */}
        {h2h.length > 0 && (
          <div>
            <h3 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[2px] mb-3 flex items-center gap-2">
              <Sword className="w-3.5 h-3.5 text-rose-400" />
              Head-to-Head Records
            </h3>
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                      <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Opponent</th>
                      <th className="px-3 py-3 text-center text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">P</th>
                      <th className="px-3 py-3 text-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">W</th>
                      <th className="px-3 py-3 text-center text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">L</th>
                      <th className="px-3 py-3 text-center text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">D</th>
                      <th className="px-3 py-3 text-right text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Win%</th>
                      <th className="px-3 py-3 text-center text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">Last</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {h2h.map(r => (
                      <tr key={r.opponent} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                        <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white truncate max-w-[200px]">
                          {r.opponent}
                        </td>
                        <td className="px-3 py-3 text-center text-gray-700 dark:text-gray-300 tabular-nums">{r.played}</td>
                        <td className="px-3 py-3 text-center text-emerald-600 dark:text-emerald-400 font-bold tabular-nums">{r.won}</td>
                        <td className="px-3 py-3 text-center text-red-600 dark:text-red-400 font-bold tabular-nums">{r.lost}</td>
                        <td className="px-3 py-3 text-center text-amber-600 dark:text-amber-400 font-bold tabular-nums">{r.drawn}</td>
                        <td className="px-3 py-3 text-right">
                          <span className={`inline-block w-12 text-center px-2 py-0.5 rounded-full text-xs font-bold tabular-nums ${
                            r.winRate >= 60 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                            : r.winRate >= 40 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                          }`}>{r.winRate}%</span>
                        </td>
                        <td className="px-3 py-3 text-center hidden sm:table-cell">
                          {r.lastResult && (
                            <span className={`inline-block w-6 h-6 rounded-md text-[10px] font-black text-white leading-6 ${
                              r.lastResult === 'won' ? 'bg-emerald-500'
                              : r.lastResult === 'lost' ? 'bg-red-500'
                              : 'bg-amber-500'
                            }`} title={r.lastDate || ''}>
                              {r.lastResult === 'won' ? 'W' : r.lastResult === 'lost' ? 'L' : 'D'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── CUSTOM AWARDS ───────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[2px] flex items-center gap-2">
              <Award className="w-3.5 h-3.5 text-violet-400" />
              Custom Awards
            </h3>
            {isAdmin && (
              <button
                onClick={() => setShowAwardModal(true)}
                className="text-xs text-primary-600 dark:text-primary-400 flex items-center gap-1 font-semibold hover:text-primary-700"
              >
                <Plus className="w-3.5 h-3.5" /> Grant Award
              </button>
            )}
          </div>
          {awards.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-6 text-center text-sm text-gray-400 dark:text-gray-500">
              {isAdmin ? 'No custom awards yet. Click "+ Grant Award" to recognise a player.' : 'No custom awards yet.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {awards.map(a => (
                <div key={a.id} className="relative overflow-hidden rounded-2xl p-5 group"
                     style={{ background: 'linear-gradient(135deg, #4c1d95 0%, #0a1019 100%)' }}>
                  <div className="absolute inset-0 border border-violet-500/25 rounded-2xl pointer-events-none" />
                  <div className="relative flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-violet-500/20 border border-violet-400/40 flex items-center justify-center flex-shrink-0 text-2xl">
                      {a.icon || '🌟'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-violet-300/80 text-[10px] font-bold uppercase tracking-[1.5px]">{a.award_name}</p>
                      {a.member && (
                        <h4 className="text-sm font-black text-white mt-0.5 truncate">{a.member.name}</h4>
                      )}
                      {a.description && (
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">{a.description}</p>
                      )}
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => setConfirmDelAward(a.id)}
                        className="p-1.5 rounded-md text-red-300 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center pt-4">
          Records derived from match results & CricHeroes-synced player stats · Season 2025–26
        </p>
      </div>

      {/* Grant award modal */}
      <Modal isOpen={showAwardModal} onClose={() => setShowAwardModal(false)} title="Grant Custom Award">
        <form onSubmit={handleAddAward} className="space-y-4">
          <Select
            label="Player *"
            value={awardForm.member_id}
            onChange={e => setAwardForm({ ...awardForm, member_id: e.target.value })}
            options={[
              { value: '', label: '— Select player —' },
              ...members.map(m => ({ value: m.id, label: m.name })),
            ]}
          />
          <Input
            label="Award Name *"
            placeholder="e.g. Best Improved Player"
            value={awardForm.award_name}
            onChange={e => setAwardForm({ ...awardForm, award_name: e.target.value })}
            required
          />
          <Input
            label="Icon (emoji)"
            placeholder="🌟"
            value={awardForm.icon}
            onChange={e => setAwardForm({ ...awardForm, icon: e.target.value })}
          />
          <Input
            label="Description (optional)"
            placeholder="e.g. for outstanding contribution this season"
            value={awardForm.description}
            onChange={e => setAwardForm({ ...awardForm, description: e.target.value })}
          />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowAwardModal(false)} className="flex-1">
              <X className="w-4 h-4 mr-1.5" /> Cancel
            </Button>
            <Button type="submit" loading={submittingAward} className="flex-1">
              Grant Award
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!confirmDelAward}
        onClose={() => setConfirmDelAward(null)}
        onConfirm={async () => {
          if (confirmDelAward) await deleteAward(confirmDelAward);
          setConfirmDelAward(null);
        }}
        title="Remove award?"
        message="This will permanently remove the award from this player."
        confirmLabel="Remove"
      />
    </div>
  );
}

export default Records;
