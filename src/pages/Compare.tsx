import { useMemo, useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { SkillRadarChart } from '../components/SkillRadarChart';
import { useMembers } from '../hooks/useMembers';
import { useMatches } from '../hooks/useMatches';
import { useCricketStats } from '../hooks/useCricketStats';
import { useMOMCounts } from '../hooks/useMOMCounts';
import { useFormGuide, type FormResult } from '../hooks/useFormGuide';
import { computeRadar, overallRating } from '../utils/playerRating';
import type { Member, MemberCricketStats } from '../types';

const ROLE_LABEL: Record<string, string> = {
  batsman: '🏏 Batsman',
  bowler: '⚡ Bowler',
  all_rounder: '🌟 All-rounder',
  wicket_keeper: '🧤 Wicket-keeper',
};

function FormBlocks({ form }: { form: FormResult[] | undefined }) {
  if (!form || form.length === 0) return <span className="text-xs text-gray-400">No data</span>;
  const ordered = [...form].slice(0, 5).reverse();
  return (
    <span className="inline-flex gap-1">
      {ordered.map((r, i) => (
        <span
          key={i}
          className={`w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-black text-white ${
            r === 'won' ? 'bg-emerald-500' : r === 'lost' ? 'bg-red-500' : 'bg-amber-500'
          }`}
        >
          {r === 'won' ? 'W' : r === 'lost' ? 'L' : 'D'}
        </span>
      ))}
    </span>
  );
}

interface PlayerSummary {
  member: Member;
  stats: MemberCricketStats | undefined;
  moms: number;
  matchesPlayed: number;
  winRate: number;
  ovr: number;
}

function buildSummary(
  memberId: string,
  members: Member[],
  stats: MemberCricketStats[],
  momCounts: Record<string, number>,
  matches: ReturnType<typeof useMatches>['matches']
): PlayerSummary | null {
  const member = members.find(m => m.id === memberId);
  if (!member) return null;
  const memberStats = stats.find(s => s.member_id === memberId);
  const moms = momCounts[memberId] || 0;
  const matchesPlayed = matches.filter(m =>
    ['won', 'lost', 'draw'].includes(m.result) &&
    m.players?.some(p => p.member_id === memberId)
  );
  const ext = matchesPlayed.filter(m => m.match_type === 'external');
  const won = ext.filter(m => m.result === 'won').length;
  const winRate = ext.length > 0 ? Math.round((won / ext.length) * 100) : 0;
  const radar = computeRadar(memberStats, moms, matchesPlayed.length);
  const ovr = overallRating(radar, member.role);

  return { member, stats: memberStats, moms, matchesPlayed: matchesPlayed.length, winRate, ovr };
}

interface StatRow {
  label: string;
  a: string | number;
  b: string | number;
  aNum: number;
  bNum: number;
  lowerIsBetter?: boolean;
}

function getStatRows(a: PlayerSummary, b: PlayerSummary): StatRow[] {
  const as = a.stats;
  const bs = b.stats;

  const parseBowlingFig = (fig: string): number => {
    const match = fig?.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  };

  return [
    {
      label: 'Runs',
      a: as?.batting_runs ?? 0,
      b: bs?.batting_runs ?? 0,
      aNum: as?.batting_runs ?? 0,
      bNum: bs?.batting_runs ?? 0,
    },
    {
      label: 'Batting Avg',
      a: (as?.batting_average ?? 0).toFixed(1),
      b: (bs?.batting_average ?? 0).toFixed(1),
      aNum: as?.batting_average ?? 0,
      bNum: bs?.batting_average ?? 0,
    },
    {
      label: 'Strike Rate',
      a: (as?.batting_strike_rate ?? 0).toFixed(0),
      b: (bs?.batting_strike_rate ?? 0).toFixed(0),
      aNum: as?.batting_strike_rate ?? 0,
      bNum: bs?.batting_strike_rate ?? 0,
    },
    {
      label: 'Highest Score',
      a: as?.batting_highest_score ?? 0,
      b: bs?.batting_highest_score ?? 0,
      aNum: as?.batting_highest_score ?? 0,
      bNum: bs?.batting_highest_score ?? 0,
    },
    {
      label: 'Wickets',
      a: as?.bowling_wickets ?? 0,
      b: bs?.bowling_wickets ?? 0,
      aNum: as?.bowling_wickets ?? 0,
      bNum: bs?.bowling_wickets ?? 0,
    },
    {
      label: 'Economy',
      a: as?.bowling_economy ? (as.bowling_economy).toFixed(1) : '—',
      b: bs?.bowling_economy ? (bs.bowling_economy).toFixed(1) : '—',
      aNum: as?.bowling_economy ?? 0,
      bNum: bs?.bowling_economy ?? 0,
      lowerIsBetter: true,
    },
    {
      label: 'Best Figures',
      a: as?.bowling_best_figures || '—',
      b: bs?.bowling_best_figures || '—',
      aNum: parseBowlingFig(as?.bowling_best_figures || ''),
      bNum: parseBowlingFig(bs?.bowling_best_figures || ''),
    },
    {
      label: 'Catches',
      a: as?.fielding_catches ?? 0,
      b: bs?.fielding_catches ?? 0,
      aNum: as?.fielding_catches ?? 0,
      bNum: bs?.fielding_catches ?? 0,
    },
    {
      label: 'Man of Match',
      a: a.moms,
      b: b.moms,
      aNum: a.moms,
      bNum: b.moms,
    },
    {
      label: 'Win Rate',
      a: `${a.winRate}%`,
      b: `${b.winRate}%`,
      aNum: a.winRate,
      bNum: b.winRate,
    },
    {
      label: 'Matches Played',
      a: a.matchesPlayed,
      b: b.matchesPlayed,
      aNum: a.matchesPlayed,
      bNum: b.matchesPlayed,
    },
  ];
}

export function Compare() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [memberA, setMemberA] = useState(searchParams.get('a') || '');
  const [memberB, setMemberB] = useState(searchParams.get('b') || '');

  const { members } = useMembers();
  const { matches } = useMatches();
  const { stats } = useCricketStats('2025-26');
  const { counts: momCounts } = useMOMCounts();
  const { formByMember } = useFormGuide();

  // Update URL when selections change
  useEffect(() => {
    const params: Record<string, string> = {};
    if (memberA) params.a = memberA;
    if (memberB) params.b = memberB;
    setSearchParams(params, { replace: true });
  }, [memberA, memberB, setSearchParams]);

  const activeMembers = useMemo(
    () => members
      .filter(m => m.status === 'active')
      .sort((a, b) => a.name.localeCompare(b.name)),
    [members]
  );

  const summaryA = useMemo(
    () => memberA ? buildSummary(memberA, members, stats, momCounts, matches) : null,
    [memberA, members, stats, momCounts, matches]
  );
  const summaryB = useMemo(
    () => memberB ? buildSummary(memberB, members, stats, momCounts, matches) : null,
    [memberB, members, stats, momCounts, matches]
  );

  const radarA = useMemo(
    () => summaryA ? computeRadar(summaryA.stats, summaryA.moms, summaryA.matchesPlayed) : null,
    [summaryA]
  );
  const radarB = useMemo(
    () => summaryB ? computeRadar(summaryB.stats, summaryB.moms, summaryB.matchesPlayed) : null,
    [summaryB]
  );

  const statRows = useMemo(
    () => summaryA && summaryB ? getStatRows(summaryA, summaryB) : [],
    [summaryA, summaryB]
  );

  const bothSelected = summaryA && summaryB;

  return (
    <div>
      <Header title="Player Comparison" subtitle="Head-to-head stats · Season 2025–26" />

      <div className="p-4 lg:p-8 space-y-6 max-w-4xl mx-auto">
        {/* Member pickers */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="text-[10px] font-black uppercase tracking-[2px] text-gray-500 dark:text-gray-400 block mb-1">
              Player A
            </label>
            <select
              value={memberA}
              onChange={e => setMemberA(e.target.value)}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select Player A</option>
              {activeMembers.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div className="flex-shrink-0 pt-5">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-black text-gray-500 dark:text-gray-400">
              VS
            </span>
          </div>

          <div className="flex-1">
            <label className="text-[10px] font-black uppercase tracking-[2px] text-gray-500 dark:text-gray-400 block mb-1">
              Player B
            </label>
            <select
              value={memberB}
              onChange={e => setMemberB(e.target.value)}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select Player B</option>
              {activeMembers.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>

        {!bothSelected && (
          <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-12 text-center">
            <p className="text-gray-400 font-medium">Select two players above to compare them head-to-head</p>
          </div>
        )}

        {bothSelected && (
          <>
            {/* Profile headers */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { summary: summaryA, color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/5' },
                { summary: summaryB, color: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/5' },
              ].map(({ summary, color, border, bg }, idx) => (
                <div key={idx} className={`rounded-2xl p-4 border ${border} ${bg} flex flex-col items-center text-center gap-2`}>
                  <Link to={`/profile/${summary.member.id}`} className="hover:opacity-80 transition-opacity">
                    {summary.member.avatar_url ? (
                      <img
                        src={summary.member.avatar_url}
                        alt={summary.member.name}
                        className="w-16 h-16 rounded-2xl object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center">
                        <span className="text-2xl font-black text-white">{summary.member.name.charAt(0)}</span>
                      </div>
                    )}
                  </Link>
                  <div>
                    <p className="font-black text-gray-900 dark:text-white text-sm leading-tight">{summary.member.name}</p>
                    {summary.member.role && (
                      <p className="text-[11px] text-gray-500 mt-0.5">{ROLE_LABEL[summary.member.role]}</p>
                    )}
                  </div>
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black ${color} bg-white/10 border ${border}`}>
                    OVR {summary.ovr}
                  </div>
                </div>
              ))}
            </div>

            {/* Radar charts */}
            {radarA && radarB && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <SkillRadarChart radar={radarA} color="#34d399" size={200} />
                  <p className="text-center text-[11px] font-bold text-emerald-400 mt-1">{summaryA.member.name.split(' ')[0]}</p>
                </div>
                <div>
                  <SkillRadarChart radar={radarB} color="#60a5fa" size={200} />
                  <p className="text-center text-[11px] font-bold text-blue-400 mt-1">{summaryB.member.name.split(' ')[0]}</p>
                </div>
              </div>
            )}

            {/* Head-to-head stats table */}
            <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-3 bg-gray-800 text-white px-4 py-2.5 text-[11px] font-black uppercase tracking-[2px]">
                <span className="text-emerald-400 text-center">{summaryA.member.name.split(' ')[0]}</span>
                <span className="text-center text-gray-400">Stat</span>
                <span className="text-blue-400 text-center">{summaryB.member.name.split(' ')[0]}</span>
              </div>
              {statRows.map((row, i) => {
                const aBetter = row.lowerIsBetter
                  ? row.aNum < row.bNum && row.aNum > 0
                  : row.aNum > row.bNum;
                const bBetter = row.lowerIsBetter
                  ? row.bNum < row.aNum && row.bNum > 0
                  : row.bNum > row.aNum;

                return (
                  <div
                    key={row.label}
                    className={`grid grid-cols-3 px-4 py-2.5 text-sm items-center ${
                      i % 2 === 0 ? 'bg-gray-50 dark:bg-gray-800/30' : 'bg-white dark:bg-gray-900/20'
                    }`}
                  >
                    <div className={`text-center font-black tabular-nums ${aBetter ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {String(row.a)}
                      {aBetter && <span className="ml-1 text-[10px]">▲</span>}
                    </div>
                    <div className="text-center text-[11px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wide">
                      {row.label}
                    </div>
                    <div className={`text-center font-black tabular-nums ${bBetter ? 'text-blue-500 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {bBetter && <span className="mr-1 text-[10px]">▲</span>}
                      {String(row.b)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Form comparison */}
            {(formByMember[memberA] || formByMember[memberB]) && (
              <div className="rounded-2xl p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                <h3 className="text-[10px] font-black uppercase tracking-[3px] text-gray-500 dark:text-gray-400 mb-3">
                  Recent Form (Last 5)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] font-bold text-emerald-400 mb-1.5">{summaryA.member.name.split(' ')[0]}</p>
                    <FormBlocks form={formByMember[memberA]} />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-blue-400 mb-1.5">{summaryB.member.name.split(' ')[0]}</p>
                    <FormBlocks form={formByMember[memberB]} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Compare;
