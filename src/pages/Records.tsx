import { CURRENT_SEASON, todayIso } from '../config/season';
import { useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Link } from 'react-router-dom';
import {
  Trophy, Crown, Award, Zap, Shield, TrendingUp, TrendingDown,
  Flame, Star, Sword, CalendarDays, Plus, X, Trash2, ChevronRight,
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

// ─── A record ────────────────────────────────────────────────────────────────
// Fourteen of these, each previously carrying its own hand-written gradient and
// border: maroon, navy, teal, violet, two browns. Dark slabs on a page whose
// every other surface is the app's own, and in light mode a wall of dark blocks.
//
// Colour now says which KIND of record it is — a green one is something we did
// well, a red one is not — as a hairline along the top and the icon's tint,
// over the house surface. The figure carries the card.
type RecordTone = 'good' | 'bad' | 'gold' | 'cool' | 'violet';

const TONE: Record<RecordTone, { rule: string; chip: string; ink: string }> = {
  good:   { rule: 'bg-emerald-400/70', chip: 'bg-emerald-500/10 dark:bg-emerald-400/15', ink: 'text-emerald-600 dark:text-emerald-300' },
  bad:    { rule: 'bg-rose-400/70',    chip: 'bg-rose-500/10 dark:bg-rose-400/15',       ink: 'text-rose-600 dark:text-rose-300' },
  gold:   { rule: 'bg-amber-400/70',   chip: 'bg-amber-500/10 dark:bg-amber-400/15',     ink: 'text-amber-600 dark:text-amber-300' },
  cool:   { rule: 'bg-sky-400/70',     chip: 'bg-sky-500/10 dark:bg-sky-400/15',         ink: 'text-sky-600 dark:text-sky-300' },
  violet: { rule: 'bg-violet-400/70',  chip: 'bg-violet-500/10 dark:bg-violet-400/15',   ink: 'text-violet-600 dark:text-violet-300' },
};

interface RecordCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | React.ReactNode;
  subtitle?: string | React.ReactNode;
  tone: RecordTone;
}

function RecordCard({ icon, label, value, subtitle, tone }: RecordCardProps) {
  const t = TONE[tone];
  return (
    <div className="glass r-card relative overflow-hidden p-4 lg:p-5 min-h-[130px] flex flex-col">
      <div className={`absolute inset-x-0 top-0 h-[3px] ${t.rule}`} />
      <div className="flex items-center gap-2">
        <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${t.chip}`}>
          {icon}
        </span>
        <span className="t-micro font-black uppercase tracking-[1.5px] text-slate-400 dark:text-white/45 truncate">
          {label}
        </span>
      </div>
      <div className="flex-1 flex flex-col justify-center mt-2">
        <div className="t-num text-2xl lg:text-3xl leading-tight text-slate-900 dark:text-white">{value}</div>
        {subtitle && (
          <div className="t-micro font-semibold text-slate-400 dark:text-white/40 mt-1 truncate">{subtitle}</div>
        )}
      </div>
    </div>
  );
}

export function Records({ embedded = false }: { embedded?: boolean } = {}) {
  const { matches } = useMatches();
  const { members } = useMembers();
  // All seasons: a club record isn't a record of one campaign. Pinned to
  // '2025-26', it could never see this season's cricket at all.
  const { stats } = useCricketStats('all');
  // Club records are all-time by definition.
  const { allTime: momCounts } = useMOMCounts();
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
        season: CURRENT_SEASON,
        icon: awardForm.icon || null,
        awarded_at: todayIso(),
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

    const topRunOuts = [...stats].filter(s => (s.batting_run_outs || 0) > 0)
      .sort((a, b) => (b.batting_run_outs || 0) - (a.batting_run_outs || 0))[0] ?? null;

    return { topRuns, topAvg, highestIndividual, topWkts, bestBowling, topCatches, topMOMs, topRunOuts, getName, getAvatar };
  }, [stats, momCounts]);

  return (
    <div>
      {!embedded && <Header title="Club Records" subtitle="Hall of fame · all seasons" />}

      <div className="p-4 lg:p-8 space-y-6">

        {/* ── Header banner ─────────────────────────────────────────────── */}
        {/* The gold stays — this is the hall of fame — but as a wash and a
            hairline over the house surface rather than a brown slab. */}
        <div className="glass r-card relative overflow-hidden p-5 lg:p-6">
          <div className="absolute inset-0 pointer-events-none"
               style={{ background: 'radial-gradient(620px circle at 88% -30%, rgba(245,158,11,0.16), transparent 62%)' }} />
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-amber-400 via-amber-300 to-transparent" />
          <div className="relative flex items-center gap-4">
            <span className="w-12 h-12 lg:w-14 lg:h-14 r-card bg-amber-400/15 ring-1 ring-amber-400/40
                             flex items-center justify-center flex-shrink-0">
              <Trophy className="w-6 h-6 lg:w-7 lg:h-7 text-amber-600 dark:text-amber-300" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display font-extrabold text-slate-900 dark:text-white text-xl lg:text-2xl leading-tight">
                Hall of Fame
              </h2>
              <p className="t-meta font-semibold text-slate-400 dark:text-white/45 mt-0.5">
                {teamRecords.total} matches · {teamRecords.won}W · {teamRecords.lost}L · {teamRecords.drawn}NR
              </p>
            </div>

            {/* Captaincy lives on its own page, off the nav. This is the one
                place it makes sense to find it from: whoever is reading the
                club's record is the person who wants to know who led it. */}
            {!embedded && (
              <Link to="/captains"
                className="hidden sm:inline-flex items-center gap-1 r-control px-3 py-2 flex-shrink-0
                           bg-amber-500/10 dark:bg-amber-400/15 t-meta font-black
                           text-amber-700 dark:text-amber-300">
                Captaincy <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          {/* On a phone the pill would squeeze the record line, so it sits
              under it instead of shrinking the thing people came for. */}
          {!embedded && (
            <Link to="/captains"
              className="sm:hidden relative flex items-center justify-between mt-4 pt-3
                         border-t border-slate-200/70 dark:border-white/10">
              <span className="t-meta font-black text-amber-700 dark:text-amber-300">
                Who has captained SCC →
              </span>
            </Link>
          )}
        </div>

        {/* ── TEAM RECORDS ─────────────────────────────────────────────── */}
        <div>
          <h3 className="t-meta font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[2px] mb-3 flex items-center gap-2">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            Team Records
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {teamRecords.highestScore && (
              <RecordCard
                icon={<TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300" />}
                label="Highest Total"
                value={`${teamRecords.highestScore.runs}`}
                subtitle={`${teamRecords.highestScore.match.our_score} vs ${teamRecords.highestScore.match.opponent}`}
                tone="good"
              />
            )}
            {teamRecords.lowestScore && (
              <RecordCard
                icon={<TrendingDown className="w-3.5 h-3.5 text-rose-600 dark:text-rose-300" />}
                label="Lowest All-out"
                value={`${teamRecords.lowestScore.runs}`}
                subtitle={`${teamRecords.lowestScore.match.our_score} vs ${teamRecords.lowestScore.match.opponent}`}
                tone="bad"
              />
            )}
            {teamRecords.biggestWin && (
              <RecordCard
                icon={<Trophy className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300" />}
                label="Biggest Victory"
                value={teamRecords.biggestWin.margin}
                subtitle={`vs ${teamRecords.biggestWin.match.opponent} · ${teamRecords.biggestWin.match.our_score?.split(' ')[0]} – ${teamRecords.biggestWin.match.opponent_score?.split(' ')[0]}`}
                tone="gold"
              />
            )}
            {teamRecords.biggestLoss && (
              <RecordCard
                icon={<Shield className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300" />}
                label="Biggest Defeat"
                value={teamRecords.biggestLoss.margin}
                subtitle={`vs ${teamRecords.biggestLoss.match.opponent} · ${teamRecords.biggestLoss.match.our_score?.split(' ')[0]} – ${teamRecords.biggestLoss.match.opponent_score?.split(' ')[0]}`}
                tone="gold"
              />
            )}
            {teamRecords.longestWin > 1 && (
              <RecordCard
                icon={<Flame className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300" />}
                label="Longest Win Streak"
                value={`${teamRecords.longestWin} matches`}
                subtitle={teamRecords.longestWinEnd ? `last: vs ${teamRecords.longestWinEnd.opponent}` : ''}
                tone="good"
              />
            )}
            {teamRecords.longestLoss > 1 && (
              <RecordCard
                icon={<TrendingDown className="w-3.5 h-3.5 text-rose-600 dark:text-rose-300" />}
                label="Longest Losing Run"
                value={`${teamRecords.longestLoss} matches`}
                subtitle={teamRecords.longestLossEnd ? `last: vs ${teamRecords.longestLossEnd.opponent}` : ''}
                tone="bad"
              />
            )}
          </div>
        </div>

        {/* ── INDIVIDUAL RECORDS ──────────────────────────────────────── */}
        {playerRecords && (
          <div>
            <h3 className="t-meta font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[2px] mb-3 flex items-center gap-2">
              <Star className="w-3.5 h-3.5 text-amber-400" fill="currentColor" />
              Individual Records · all seasons
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {playerRecords.topRuns && (
                <RecordCard
                  icon={<TrendingUp className="w-3.5 h-3.5 text-sky-600 dark:text-sky-300" />}
                  label="Most Runs"
                  value={`${playerRecords.topRuns.batting_runs}`}
                  subtitle={`${playerRecords.getName(playerRecords.topRuns)} · Avg ${playerRecords.topRuns.batting_average.toFixed(1)}`}
                  tone="cool"
                />
              )}
              {playerRecords.highestIndividual && (
                <RecordCard
                  icon={<Award className="w-3.5 h-3.5 text-violet-600 dark:text-violet-300" />}
                  label="Highest Score"
                  value={playerRecords.highestIndividual.batting_highest_score || '—'}
                  subtitle={playerRecords.getName(playerRecords.highestIndividual)}
                  tone="violet"
                />
              )}
              {playerRecords.topAvg && (
                <RecordCard
                  icon={<Star className="w-3.5 h-3.5 text-sky-600 dark:text-sky-300" fill="currentColor" />}
                  label="Best Average"
                  value={playerRecords.topAvg.batting_average.toFixed(1)}
                  subtitle={`${playerRecords.getName(playerRecords.topAvg)} · ${playerRecords.topAvg.batting_innings} inns`}
                  tone="cool"
                />
              )}
              {playerRecords.topWkts && (
                <RecordCard
                  icon={<Zap className="w-3.5 h-3.5 text-rose-600 dark:text-rose-300" fill="currentColor" />}
                  label="Most Wickets"
                  value={`${playerRecords.topWkts.bowling_wickets}`}
                  subtitle={`${playerRecords.getName(playerRecords.topWkts)} · Eco ${playerRecords.topWkts.bowling_economy.toFixed(2)}`}
                  tone="bad"
                />
              )}
              {playerRecords.bestBowling && (
                <RecordCard
                  icon={<Award className="w-3.5 h-3.5 text-rose-600 dark:text-rose-300" />}
                  label="Best Bowling"
                  value={playerRecords.bestBowling.s.bowling_best_figures || '—'}
                  subtitle={playerRecords.getName(playerRecords.bestBowling.s)}
                  tone="bad"
                />
              )}
              {playerRecords.topCatches && (
                <RecordCard
                  icon={<Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300" />}
                  label="Most Catches"
                  value={`${playerRecords.topCatches.fielding_catches}`}
                  subtitle={playerRecords.getName(playerRecords.topCatches)}
                  tone="good"
                />
              )}
              {playerRecords.topRunOuts && (
                <RecordCard
                  icon={<span className="text-sm">🏃</span>}
                  label="Most Run Outs (batting)"
                  value={`${playerRecords.topRunOuts.batting_run_outs || 0}`}
                  subtitle={playerRecords.getName(playerRecords.topRunOuts)}
                  tone="gold"
                />
              )}
              {playerRecords.topMOMs && (() => {
                const m = stats.find(s => s.member_id === playerRecords.topMOMs!.id);
                return m ? (
                  <RecordCard
                    icon={<Crown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300" fill="currentColor" />}
                    label="Most MOM Awards"
                    value={`${playerRecords.topMOMs.count}`}
                    subtitle={playerRecords.getName(m)}
                    tone="gold"
                  />
                ) : null;
              })()}
            </div>
          </div>
        )}

        {/* ── PLAYERS OF THE WEEK + MONTH (side by side) ─────────────── */}
        {(playerOfWeek || playerOfMonth) && (
          <div>
            <h3 className="t-meta font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[2px] mb-3 flex items-center gap-2">
              <CalendarDays className="w-3.5 h-3.5 text-amber-400" />
              Players in Form
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Player of the Week */}
              {playerOfWeek && (
                <div className="glass r-card relative overflow-hidden p-5 lg:p-6">
                  <div className="absolute inset-0 pointer-events-none"
                       style={{ background: 'radial-gradient(420px circle at 90% -25%, rgba(244,114,182,0.14), transparent 62%)' }} />
                  <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-pink-400 via-pink-300 to-transparent" />
                  <div className="relative flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <Crown className="w-3.5 h-3.5 text-pink-600 dark:text-pink-300" fill="currentColor" />
                      <span className="t-micro font-black uppercase tracking-[1.5px] text-pink-600 dark:text-pink-300">Player of the Week</span>
                    </div>
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-pink-500/10 dark:bg-pink-400/15 text-pink-600 dark:text-pink-300 t-micro font-black">
                      <Crown className="w-2.5 h-2.5" fill="currentColor" />
                      {playerOfWeek.moms}
                    </span>
                  </div>
                  <div className="relative flex items-center gap-4">
                    {playerOfWeek.member.avatar_url ? (
                      <img src={playerOfWeek.member.avatar_url} alt=""
                           className="w-16 h-16 lg:w-20 lg:h-20 r-card object-cover ring-1 ring-pink-400/40 flex-shrink-0" />
                    ) : (
                      <span className="w-16 h-16 lg:w-20 lg:h-20 r-card bg-pink-400/15 ring-1 ring-pink-400/40 flex items-center justify-center flex-shrink-0">
                        <span className="t-num text-2xl text-pink-600 dark:text-pink-300">{playerOfWeek.member.name.charAt(0)}</span>
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display font-extrabold text-slate-900 dark:text-white text-xl lg:text-2xl truncate">{playerOfWeek.member.name}</h3>
                      <p className="t-meta font-semibold text-slate-400 dark:text-white/45 mt-0.5">{playerOfWeek.matchesPlayedInPeriod} match{playerOfWeek.matchesPlayedInPeriod !== 1 ? 'es' : ''} · last 7 days</p>
                      {playerOfWeek.tieBroken && (
                        <p className="t-micro text-slate-400 dark:text-white/35 mt-1">tie-broken by season MVP score</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Player of the Month */}
              {playerOfMonth && (
                <div className="glass r-card relative overflow-hidden p-5 lg:p-6">
                  <div className="absolute inset-0 pointer-events-none"
                       style={{ background: 'radial-gradient(420px circle at 90% -25%, rgba(251,191,36,0.14), transparent 62%)' }} />
                  <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-amber-400 via-amber-300 to-transparent" />
                  <div className="relative flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <Crown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300" fill="currentColor" />
                      <span className="t-micro font-black uppercase tracking-[1.5px] text-amber-600 dark:text-amber-300">Player of the Month</span>
                    </div>
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-500/10 dark:bg-amber-400/15 text-amber-600 dark:text-amber-300 t-micro font-black">
                      <Crown className="w-2.5 h-2.5" fill="currentColor" />
                      {playerOfMonth.moms}
                    </span>
                  </div>
                  <div className="relative flex items-center gap-4">
                    {playerOfMonth.member.avatar_url ? (
                      <img src={playerOfMonth.member.avatar_url} alt=""
                           className="w-16 h-16 lg:w-20 lg:h-20 r-card object-cover ring-1 ring-amber-400/40 flex-shrink-0" />
                    ) : (
                      <span className="w-16 h-16 lg:w-20 lg:h-20 r-card bg-amber-400/15 ring-1 ring-amber-400/40 flex items-center justify-center flex-shrink-0">
                        <span className="t-num text-2xl text-amber-600 dark:text-amber-300">{playerOfMonth.member.name.charAt(0)}</span>
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display font-extrabold text-slate-900 dark:text-white text-xl lg:text-2xl truncate">{playerOfMonth.member.name}</h3>
                      <p className="t-meta font-semibold text-slate-400 dark:text-white/45 mt-0.5">{playerOfMonth.matchesPlayedInPeriod} match{playerOfMonth.matchesPlayedInPeriod !== 1 ? 'es' : ''} · {playerOfMonth.periodLabel}</p>
                      {playerOfMonth.tieBroken && (
                        <p className="t-micro text-slate-400 dark:text-white/35 mt-1">tie-broken by season MVP score</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 6-month history timeline */}
            {monthlyHistory.some(m => m.winner) && (
              <Card className="mt-4 p-4">
                <p className="t-micro font-bold text-gray-400 uppercase tracking-[1.5px] mb-3 flex items-center gap-1.5">
                  <Crown className="w-3 h-3 text-amber-400" fill="currentColor" />
                  Last 6 Months · Player of the Month
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {monthlyHistory.map(h => (
                    <div key={h.month}
                         className="r-card border border-gray-100 dark:border-gray-800 p-2.5 text-center hover:border-amber-300 dark:hover:border-amber-700 transition-colors">
                      <p className="t-micro font-bold uppercase tracking-wider text-gray-400">{h.monthLabel}</p>
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
                          <p className="t-meta font-bold text-gray-800 dark:text-gray-200 mt-1.5 truncate">{h.winner.member.name.split(' ')[0]}</p>
                          <p className="t-micro text-amber-600 dark:text-amber-400 font-semibold">👑 {h.winner.moms}</p>
                        </>
                      ) : (
                        <div className="mt-2 t-micro text-gray-300 dark:text-gray-600 italic py-3">—</div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ── HEAD-TO-HEAD vs every opponent ──────────────────────────── */}
        {h2h.length > 0 && (
          <div>
            <h3 className="t-meta font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[2px] mb-3 flex items-center gap-2">
              <Sword className="w-3.5 h-3.5 text-rose-400" />
              Head-to-Head Records
            </h3>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                      <th className="px-4 py-3 text-left t-micro font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Opponent</th>
                      <th className="px-3 py-3 text-center t-micro font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">P</th>
                      <th className="px-3 py-3 text-center t-micro font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">W</th>
                      <th className="px-3 py-3 text-center t-micro font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">L</th>
                      <th className="px-3 py-3 text-center t-micro font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">NR</th>
                      <th className="px-3 py-3 text-right t-micro font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Win%</th>
                      <th className="px-3 py-3 text-center t-micro font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">Last</th>
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
                            <span className={`inline-block w-6 h-6 r-card t-micro font-black text-white leading-6 ${
                              r.lastResult === 'won' ? 'bg-emerald-500'
                              : r.lastResult === 'lost' ? 'bg-red-500'
                              : 'bg-amber-500'
                            }`} title={r.lastDate || ''}>
                              {r.lastResult === 'won' ? 'W' : r.lastResult === 'lost' ? 'L' : 'NR'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ── CUSTOM AWARDS ───────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="t-meta font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[2px] flex items-center gap-2">
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
            <Card className="border-dashed p-6 text-center text-sm text-gray-400 dark:text-gray-500">
              {isAdmin ? 'No custom awards yet. Click "+ Grant Award" to recognise a player.' : 'No custom awards yet.'}
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {awards.map(a => (
                <div key={a.id} className="glass r-card relative overflow-hidden p-5 group">
                  <div className="absolute inset-x-0 top-0 h-[3px] bg-violet-400/70" />
                  <div className="relative flex items-center gap-3">
                    <span className="w-12 h-12 r-card bg-violet-500/10 dark:bg-violet-400/15 ring-1 ring-violet-400/30
                                     flex items-center justify-center flex-shrink-0 text-2xl">
                      {a.icon || '🌟'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="t-micro font-black uppercase tracking-[1.5px] text-violet-600 dark:text-violet-300">{a.award_name}</p>
                      {a.member && (
                        <h4 className="t-body font-bold text-slate-900 dark:text-white mt-0.5 truncate">{a.member.name}</h4>
                      )}
                      {a.description && (
                        <p className="t-meta text-gray-400 truncate mt-0.5">{a.description}</p>
                      )}
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => setConfirmDelAward(a.id)}
                        className="p-1.5 r-control text-red-300 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all"
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
          Records derived from match results & CricHeroes-synced player stats · all seasons
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
