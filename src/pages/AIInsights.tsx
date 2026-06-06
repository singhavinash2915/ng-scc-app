import { useState } from 'react';
import { Sparkles, Brain, Users, TrendingUp, MessageSquare, Target, Zap, ChevronRight, RefreshCw, Bot, Send } from 'lucide-react';
import { useMembers } from '../hooks/useMembers';
import { useMatches } from '../hooks/useMatches';
import { useTransactions } from '../hooks/useTransactions';
import { useTournaments } from '../hooks/useTournaments';
import { useCricketStats } from '../hooks/useCricketStats';
import { useAIInsight } from '../hooks/useAIInsight';
import { useScorecardHighlights } from '../hooks/useScorecardHighlights';
import { supabaseUrl, supabaseAnonKey } from '../lib/supabase';

const SCC_TEAM_ID = 7927431;

// Identify which innings is SCC's. The CricHeroes scorecard uses snake_case
// `team_id` (not camelCase `teamId`). We also accept a team-name fallback in
// case the API ever changes. Either match is sufficient.
function isSccInning(inn: Record<string, unknown>): boolean {
  const id = (inn as { team_id?: number }).team_id;
  if (id === SCC_TEAM_ID) return true;
  const name = String((inn as { teamName?: string }).teamName || '').toLowerCase();
  return name.includes('sangria') || name.includes(' scc') || name === 'scc';
}

// Fetch the actual scorecard for a CricHeroes match and return SCC batting +
// bowling rows so we can build a faithful match-report prompt. Returns null on any error.
async function fetchSccScorecardRows(chMatchId: string | null | undefined) {
  if (!chMatchId) return null;
  try {
    const r = await fetch(
      `${supabaseUrl}/functions/v1/cricheroes?matchId=${chMatchId}&type=scorecard`,
      { headers: { Authorization: `Bearer ${supabaseAnonKey}`, apikey: supabaseAnonKey } },
    );
    if (!r.ok) return null;
    const pp = await r.json() as Record<string, unknown>;
    const sc = pp?.scorecard as Array<Record<string, unknown>> | undefined;
    if (!sc?.length) return null;

    const sccInning = sc.find(inn => isSccInning(inn));
    const oppInning = sc.find(inn => !isSccInning(inn));

    // ⚠️ Sanity check — if we can't positively identify the SCC innings, bail out.
    // Returning the wrong innings would cause the AI to attribute opposition
    // performances to SCC players (which is exactly the bug we're fixing).
    if (!sccInning) return null;

    return {
      // SCC's batting innings — SCC batters are here
      sccBatting: (sccInning.batting as Array<Record<string, unknown>>) ?? [],
      // SCC bowls in the OPPONENT's batting innings — so bowlers there are SCC bowlers
      sccBowling: (oppInning?.bowling as Array<Record<string, unknown>>) ?? [],
      sccTotal:   (sccInning.inning as { total_run?: number; total_wicket?: number })?.total_run,
      sccWkts:    (sccInning.inning as { total_run?: number; total_wicket?: number })?.total_wicket,
      oppTotal:   (oppInning?.inning as { total_run?: number; total_wicket?: number })?.total_run,
      oppWkts:    (oppInning?.inning as { total_run?: number; total_wicket?: number })?.total_wicket,
      oppName:    oppInning?.teamName as string | undefined,
    };
  } catch {
    return null;
  }
}
import { AIInsightCard } from '../components/AIInsightCard';
import { CricketIdentityCard } from '../components/CricketIdentityCard';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

type Tab = 'overview' | 'squad' | 'identity' | 'chat';

export function AIInsights() {
  const { members } = useMembers();
  const { matches } = useMatches();
  const { transactions } = useTransactions();
  const { tournaments } = useTournaments();
  const { stats, getLeaderboard } = useCricketStats();
  const { generateInsight, error: aiError } = useAIInsight();
  const { matchHighlights, seasonRecords, playerCareerBests } = useScorecardHighlights();

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [selectedMember, setSelectedMember] = useState<string>('');
  const [selectedMatch, setSelectedMatch] = useState<string>('');
  const [insights, setInsights] = useState<Record<string, string | null>>({});
  const [loadingInsight, setLoadingInsight] = useState<Record<string, boolean>>({});
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'ai'; text: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const upcomingMatches = matches.filter(m => m.result === 'upcoming');
  const recentMatches = matches.filter(m => m.result !== 'upcoming').slice(0, 10);
  const leaderboard = getLeaderboard();

  // stateKey  = key used for insights/loadingInsight state (what the UI reads)
  // cacheKey  = key used for Supabase cache (can be dynamic/match-specific)
  const generateSingleInsight = async (
    stateKey: string,
    type: Parameters<typeof generateInsight>[0],
    data: Record<string, unknown>,
    noCache = false,
    cacheKey?: string,
  ) => {
    setLoadingInsight(prev => ({ ...prev, [stateKey]: true }));
    const result = await generateInsight(type, data, noCache ? undefined : (cacheKey ?? stateKey));
    setInsights(prev => ({ ...prev, [stateKey]: result }));
    setLoadingInsight(prev => ({ ...prev, [stateKey]: false }));
  };

  const handleSquadSelector = (forceRefresh = false) => {
    const match = matches.find(m => m.id === selectedMatch) || upcomingMatches[0];

    // Last 10 completed matches — the selection window
    // match_players (who was actually picked each game) is the availability signal;
    // we do NOT use in-app polls — squad is managed via WhatsApp and updated in the app.
    const last10 = matches
      .filter(m => ['won', 'lost', 'draw'].includes(m.result))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10);

    // Build rich player profiles: recent selection frequency + CricHeroes stats
    const players = members
      .filter(m => m.status === 'active')
      .map(m => {
        const s = stats.find(st => st.member_id === m.id);

        // Count how many of the last 10 matches this player was actually selected
        const recentSelected = last10.filter(match =>
          match.players?.some(p => p.member_id === m.id)
        ).length;

        // Team W/L when they were in the squad (newest first, max 5)
        const recentResults = last10
          .filter(match => match.players?.some(p => p.member_id === m.id))
          .slice(0, 5)
          .map(match => match.result[0].toUpperCase())
          .join('');

        return {
          name: m.name,
          role: m.role || 'unknown',
          jersey: m.jersey_number,

          // ── Selection frequency (PRIMARY — how often are they picked?) ──
          last_10_selected: recentSelected,
          last_10_pct: last10.length > 0
            ? `${Math.round((recentSelected / last10.length) * 100)}%`
            : '0%',
          recent_form: recentResults || '—',

          // ── CricHeroes stats (SECONDARY — quality ranking within available pool) ──
          ch_runs: s?.batting_runs ?? 0,
          ch_avg: Number((s?.batting_average ?? 0).toFixed(1)),
          ch_sr: Number((s?.batting_strike_rate ?? 0).toFixed(0)),
          ch_hs: s?.batting_highest_score ?? 0,
          ch_fifties: s?.batting_fifties ?? 0,
          ch_wickets: s?.bowling_wickets ?? 0,
          ch_economy: Number((s?.bowling_economy ?? 0).toFixed(1)),
          ch_best: s?.bowling_best_figures || '—',
          ch_catches: s?.fielding_catches ?? 0,
        };
      })
      // Only include players who have been selected at least once in the last 10 matches
      .filter(p => p.last_10_selected > 0)
      // Sort by recent selection frequency, then by runs as tiebreaker
      .sort((a, b) => b.last_10_selected - a.last_10_selected || b.ch_runs - a.ch_runs);

    // If a squad has already been selected for the match (admin populated match.players),
    // build a rich pre-selected-squad object with full stats for each chosen player.
    // The AI will then analyse THAT specific squad's expected performance instead of
    // recommending one from scratch.
    const preSelectedSquad = match?.players?.length
      ? match.players
          .map(mp => {
            const member = members.find(mm => mm.id === mp.member_id);
            const s = stats.find(st => st.member_id === mp.member_id);
            if (!member) return null;
            const recentSelected = last10.filter(mt => mt.players?.some(p => p.member_id === mp.member_id)).length;
            return {
              name: member.name,
              role: member.role || 'unknown',
              jersey: member.jersey_number,
              team: mp.team || null,
              last_10_selected: recentSelected,
              last_10_pct: last10.length > 0 ? `${Math.round((recentSelected / last10.length) * 100)}%` : '0%',
              ch_runs: s?.batting_runs ?? 0,
              ch_avg: Number((s?.batting_average ?? 0).toFixed(1)),
              ch_sr: Number((s?.batting_strike_rate ?? 0).toFixed(0)),
              ch_hs: s?.batting_highest_score ?? 0,
              ch_fifties: s?.batting_fifties ?? 0,
              ch_wickets: s?.bowling_wickets ?? 0,
              ch_economy: Number((s?.bowling_economy ?? 0).toFixed(1)),
              ch_best: s?.bowling_best_figures || '—',
              ch_catches: s?.fielding_catches ?? 0,
            };
          })
          .filter(Boolean)
      : null;

    // Cache key includes whether a squad is set so analyses don't collide.
    const squadCacheKey = `squad_${match?.date || 'next'}_${preSelectedSquad ? 'analysis' : 'recommend'}_v3`;
    generateSingleInsight('squad', 'squad_selector', {
      match: match ? {
        opponent: match.opponent,
        venue: match.venue,
        date: match.date,
        match_type: match.match_type,
      } : null,
      preSelectedSquad,
      players,
      last_10_window: last10.length,
      total_in_pool: players.length,
    }, forceRefresh, squadCacheKey);
  };

  const handleMatchPrediction = (forceRefresh = false) => {
    const match = matches.find(m => m.id === selectedMatch) || upcomingMatches[0];

    // Recent external form: last 8 matches
    const recentForm = matches
      .filter(m => ['won', 'lost', 'draw'].includes(m.result) && m.match_type === 'external')
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8)
      .map(m => ({
        date: m.date,
        opponent: m.opponent,
        result: m.result,
        our_score: m.our_score,
        opp_score: m.opponent_score,
      }));

    // Likely squad = players selected in at least 3 of last 10 matches + CricHeroes stats
    const last10 = matches
      .filter(m => ['won', 'lost', 'draw'].includes(m.result))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10);

    const likelySquad = members
      .filter(m => m.status === 'active')
      .map(m => {
        const s = stats.find(st => st.member_id === m.id);
        const recentSelected = last10.filter(match =>
          match.players?.some(p => p.member_id === m.id)
        ).length;
        return {
          name: m.name,
          role: m.role,
          last_10_selected: recentSelected,
          ch_runs: s?.batting_runs ?? 0,
          ch_avg: Number((s?.batting_average ?? 0).toFixed(1)),
          ch_wickets: s?.bowling_wickets ?? 0,
          ch_economy: Number((s?.bowling_economy ?? 0).toFixed(1)),
        };
      })
      .filter(p => p.last_10_selected >= 3)
      .sort((a, b) => b.last_10_selected - a.last_10_selected)
      .slice(0, 15);

    const predCacheKey = `prediction_${match?.date || 'next'}_${match?.opponent?.replace(/\s+/g, '') || 'tbd'}_v2`;
    generateSingleInsight('prediction', 'match_prediction', {
      match: match ? {
        opponent: match.opponent,
        venue: match.venue,
        date: match.date,
        match_type: match.match_type,
      } : null,
      likelySquad,
      recentForm,
      winLoss: {
        last8: recentForm.map(m => m.result[0].toUpperCase()).join(''),
        wins: recentForm.filter(m => m.result === 'won').length,
        losses: recentForm.filter(m => m.result === 'lost').length,
      },
    }, forceRefresh, predCacheKey);
  };

  const handleCricketDNA = async (memberId: string, forceRefresh = false) => {
    const member = members.find(m => m.id === memberId);
    const memberStats = stats.find(s => s.member_id === memberId);
    if (!member) return;
    const key = `dna_${memberId}`;
    generateSingleInsight(key, 'cricket_dna', { member, stats: memberStats || {} }, forceRefresh);
  };


  const handleFormTracker = (memberId: string, forceRefresh = false) => {
    const member = members.find(m => m.id === memberId);
    const memberStats = stats.find(s => s.member_id === memberId);
    const memberMatches = recentMatches.filter(m => m.players?.some(p => p.member_id === memberId)).slice(0, 5);
    generateSingleInsight(`form_${memberId}`, 'form_tracker', {
      member,
      stats: memberStats || {},
      recentMatches: memberMatches.map(m => ({ date: m.date, result: m.result, opponent: m.opponent })),
      careerAverage: memberStats?.batting_average || 0,
    }, forceRefresh);
  };

  const handleChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatLoading(true);

    const topRunScorer = [...stats].sort((a, b) => b.batting_runs - a.batting_runs)[0];
    const topWicketTaker = [...stats].filter(s => s.bowling_wickets > 0).sort((a, b) => b.bowling_wickets - a.bowling_wickets)[0];
    const mvpPlayer = leaderboard[0];
    const allMatchesCount = matches.length;
    // External matches only for overall club stats
    const completedMatches = matches.filter(m => m.match_type !== 'internal' && ['won','lost','draw'].includes(m.result));
    const wons = completedMatches.filter(m => m.result === 'won').length;

    // ── 1. Members — full profile with balance + cricket stats ──────────────
    const allMemberProfiles = members.map(m => {
      const s = stats.find(st => st.member_id === m.id);
      // Per-member transaction summary
      const memberTxns = transactions.filter(t => t.member_id === m.id);
      const totalDeposited = memberTxns.filter(t => t.type === 'deposit').reduce((sum, t) => sum + t.amount, 0);
      const totalFeesPaid  = memberTxns.filter(t => t.type === 'match_fee').reduce((sum, t) => sum + Math.abs(t.amount), 0);
      return {
        name: m.name,
        status: m.status,
        matches_played: m.matches_played,
        wallet_balance: m.balance,
        total_deposited: totalDeposited,
        total_fees_paid: totalFeesPaid,
        // CricHeroes stats (null = not imported yet)
        batting_runs: s?.batting_runs ?? null,
        batting_innings: s?.batting_innings ?? null,
        batting_average: s?.batting_average ?? null,
        batting_strike_rate: s?.batting_strike_rate ?? null,
        batting_highest_score: s?.batting_highest_score ?? null,
        batting_fifties: s?.batting_fifties ?? null,
        batting_hundreds: s?.batting_hundreds ?? null,
        batting_ducks: s?.batting_ducks ?? null,
        bowling_wickets: s?.bowling_wickets ?? null,
        bowling_overs: s?.bowling_overs ?? null,
        bowling_economy: s?.bowling_economy ?? null,
        bowling_average: s?.bowling_average ?? null,
        bowling_best_figures: s?.bowling_best_figures ?? null,
        bowling_five_wickets: s?.bowling_five_wickets ?? null,
        fielding_catches: s?.fielding_catches ?? null,
        fielding_stumpings: s?.fielding_stumpings ?? null,
        fielding_run_outs: s?.fielding_run_outs ?? null,
      };
    });

    // ── 2. All Matches ───────────────────────────────────────────────────────
    const allMatchesData = matches.map(m => ({
      date: m.date,
      opponent: m.opponent,
      result: m.result,
      venue: m.venue,
      our_score: m.our_score,
      opponent_score: m.opponent_score,
      match_fee: m.match_fee,
      match_type: m.match_type,
      man_of_match: m.man_of_match?.name ?? null,
      players_count: m.players?.length ?? 0,
    }));

    // ── 3. Transactions — recent 50 + club financial totals ──────────────────
    const recentTxns = [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 50)
      .map(t => ({
        date: t.date,
        type: t.type,
        amount: t.amount,
        member: t.member?.name ?? null,
        description: t.description,
      }));

    const totalDepositsEver  = transactions.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0);
    const totalExpensesEver  = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);
    const totalMatchFeesEver = transactions.filter(t => t.type === 'match_fee').reduce((s, t) => s + Math.abs(t.amount), 0);
    const totalFunds         = members.reduce((s, m) => s + m.balance, 0);

    // ── 4. Tournaments ───────────────────────────────────────────────────────
    const tournamentsData = tournaments.map(t => ({
      name: t.name,
      status: t.status,
      result: t.result,
      our_position: t.our_position,
      format: t.format,
      start_date: t.start_date,
      end_date: t.end_date,
      venue: t.venue,
      prize_money: t.prize_money,
      entry_fee: t.entry_fee,
    }));

    // ── MOM leaderboard — who has won Man of the Match most this season ──────
    const momTally: Record<string, number> = {};
    matches.forEach(m => {
      const momName = m.man_of_match?.name;
      if (momName && m.result && m.result !== 'upcoming' && m.result !== 'cancelled') {
        momTally[momName] = (momTally[momName] || 0) + 1;
      }
    });
    const momLeaderboard = Object.entries(momTally)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, awards: count }));
    const topMOM = momLeaderboard[0];

    // ── 5. Club summary ──────────────────────────────────────────────────────
    const clubSummary = {
      totalMembers: members.length,
      activeMembers: members.filter(m => m.status === 'active').length,
      totalMatchesRecorded: allMatchesCount,
      externalMatchesCompleted: completedMatches.length,
      wins: wons,
      losses: completedMatches.filter(m => m.result === 'lost').length,
      draws: completedMatches.filter(m => m.result === 'draw').length,
      winRate: completedMatches.length > 0 ? `${Math.round(wons / completedMatches.length * 100)}%` : 'N/A',
      clubFunds: `₹${totalFunds.toLocaleString('en-IN')}`,
      totalDepositsEver: `₹${totalDepositsEver.toLocaleString('en-IN')}`,
      totalExpensesEver: `₹${totalExpensesEver.toLocaleString('en-IN')}`,
      totalMatchFeesCollected: `₹${totalMatchFeesEver.toLocaleString('en-IN')}`,
      topRunScorer: topRunScorer ? `${topRunScorer.member?.name} — ${topRunScorer.batting_runs} runs (avg ${topRunScorer.batting_average})` : 'N/A',
      topWicketTaker: topWicketTaker ? `${topWicketTaker.member?.name} — ${topWicketTaker.bowling_wickets} wkts (eco ${topWicketTaker.bowling_economy})` : 'N/A',
      mvp: mvpPlayer ? `${mvpPlayer.member?.name} (${mvpPlayer.batting_runs}R · ${mvpPlayer.bowling_wickets}W)` : 'N/A',
      totalMOMAwardsThisSeason: momLeaderboard.reduce((s, x) => s + x.awards, 0),
      topMOMWinner: topMOM ? `${topMOM.name} — ${topMOM.awards} MOM award${topMOM.awards > 1 ? 's' : ''}` : 'N/A',
      tournamentsPlayed: tournamentsData.length,
    };

    // Compact scorecard summaries (only most recent 50 matches to keep prompt size sane)
    const recentMatchHighlights = matchHighlights.slice(0, 50);
    // Top 30 players by season runs — covers all active SCC members
    const topCareerStats = playerCareerBests.slice(0, 30);

    const result = await generateInsight('club_chat', {
      question: userMsg,
      clubSummary,
      allMembers: allMemberProfiles,
      allMatches: allMatchesData,
      chMatches: allMatchesData, // same source — populated by CricHeroes sync
      momLeaderboard,
      recentTransactions: recentTxns,
      tournaments: tournamentsData,
      // ── NEW: detailed scorecard data (synced from CricHeroes per match) ──
      // Use these to answer questions about specific matches, individual
      // batting/bowling performances, season records, and player bests.
      matchHighlights: recentMatchHighlights,  // [{date, scores, best_batter, best_bowler, ...}]
      seasonRecords,                            // highest individual, best bowling, highest team total, lowest all-out
      playerCareerBests: topCareerStats,        // [{name, highest_score, best_bowling, total_runs, total_wickets}]
    });

    setChatMessages(prev => [...prev, { role: 'ai', text: result || 'Sorry, I could not generate a response.' }]);
    setChatLoading(false);
  };

  const tabs: Array<{ id: Tab; label: string; icon: typeof Sparkles }> = [
    { id: 'overview', label: 'Overview', icon: Sparkles },
    { id: 'chat', label: 'AI Chat', icon: MessageSquare },
    { id: 'identity', label: 'Cricket DNA', icon: Zap },
    { id: 'squad', label: 'Squad AI', icon: Users },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-emerald-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-white/20 rounded-xl">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">SCC AI Intelligence</h1>
            <p className="text-white/70 text-sm">Powered by AI — Your cricket club's brain</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { label: 'Members', value: members.length },
            { label: 'Matches', value: recentMatches.length },
            { label: 'Stats Loaded', value: stats.length },
          ].map(s => (
            <div key={s.label} className="bg-white/15 rounded-xl p-3 text-center border border-white/20">
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-white/70">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Quick Insights */}
            <Card className="p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary-500" />
                Quick AI Insights
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'Squad Selector', desc: 'Best XI for next match', tab: 'squad' as Tab },
                  { label: 'Cricket DNA Cards', desc: 'Player personality analysis', tab: 'identity' as Tab },
                  { label: 'Club AI Chat', desc: 'Ask anything about SCC', tab: 'chat' as Tab },
                ].map(item => (
                  <button
                    key={item.tab}
                    onClick={() => setActiveTab(item.tab)}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors group"
                  >
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-primary-500 transition-colors" />
                  </button>
                ))}
              </div>
            </Card>

            {/* Stats Summary */}
            <Card className="p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Target className="w-4 h-4 text-primary-500" />
                Season Highlights
              </h3>
              {stats.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Top Scorer</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {leaderboard[0]?.member?.name || '-'} ({leaderboard[0]?.batting_runs || 0} runs)
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Top Wicket Taker</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {[...stats].sort((a, b) => b.bowling_wickets - a.bowling_wickets)[0]?.member?.name || '-'} ({[...stats].sort((a, b) => b.bowling_wickets - a.bowling_wickets)[0]?.bowling_wickets || 0} wkts)
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Best Average</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {[...stats].filter(s => s.batting_innings >= 3).sort((a, b) => b.batting_average - a.batting_average)[0]?.member?.name || '-'} ({([...stats].filter(s => s.batting_innings >= 3).sort((a, b) => b.batting_average - a.batting_average)[0]?.batting_average || 0).toFixed(1)})
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-gray-400 text-sm">No CricHeroes stats loaded yet</p>
                  <p className="text-gray-400 text-xs mt-1">Go to Settings to import cricket stats</p>
                </div>
              )}
            </Card>
          </div>

          {/* Recent match AI report */}
          {recentMatches[0] && (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary-500" />
                  Latest Match AI Report
                </h3>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    const m = recentMatches[0];
                    const sc = await fetchSccScorecardRows(m.ch_match_id);
                    generateSingleInsight('match_report', 'match_report', {
                      match: {
                        date: m.date, opponent: m.opponent, venue: m.venue,
                        result: m.result, our_score: m.our_score, opponent_score: m.opponent_score,
                        man_of_match: m.man_of_match?.name ?? null,
                      },
                      scorecard: sc,
                      players: m.players?.map(p => ({ name: p.member?.name, team: p.team })),
                    });
                  }}
                  className="text-xs"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Generate
                </Button>
              </div>
              <AIInsightCard
                title="Match Report"
                insight={insights.match_report || null}
                loading={loadingInsight.match_report || false}
                error={null}
                onRefresh={async () => {
                  const m = recentMatches[0];
                  const sc = await fetchSccScorecardRows(m.ch_match_id);
                  generateSingleInsight('match_report', 'match_report', {
                    match: {
                      date: m.date, opponent: m.opponent, venue: m.venue,
                      result: m.result, our_score: m.our_score, opponent_score: m.opponent_score,
                      man_of_match: m.man_of_match?.name ?? null,
                    },
                    scorecard: sc,
                    players: m.players?.map(p => ({ name: p.member?.name, team: p.team })),
                  }, true);
                }}
              />
              {!insights.match_report && !loadingInsight.match_report && (
                <div className="text-center py-4 text-gray-400 text-sm">
                  Last match: {recentMatches[0].opponent} ({recentMatches[0].result}) — Click Generate for AI report
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* Squad AI Tab */}
      {activeTab === 'squad' && (() => {
        // Compute last-10 participation for the preview tags
        const last10Preview = matches
          .filter(m => ['won', 'lost', 'draw'].includes(m.result))
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 10);

        const participationList = members
          .filter(m => m.status === 'active')
          .map(m => ({
            member: m,
            count: last10Preview.filter(match => match.players?.some(p => p.member_id === m.id)).length,
          }))
          .filter(x => x.count > 0)
          .sort((a, b) => b.count - a.count);

        return (
        <div className="space-y-4">
          {/* Match selector + squad preview */}
          <Card className="p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary-500" />
              AI Smart Squad Selector
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Based on last {last10Preview.length} matches (who was actually selected) + CricHeroes stats.
            </p>

            <select
              value={selectedMatch}
              onChange={e => setSelectedMatch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm mb-3"
            >
              <option value="">{upcomingMatches[0] ? `Next match (${upcomingMatches[0].opponent || upcomingMatches[0].date})` : 'No upcoming matches'}</option>
              {upcomingMatches.map(m => (
                <option key={m.id} value={m.id}>{m.date} — {m.match_type === 'internal' ? 'Internal Match' : m.opponent || 'TBD'} at {m.venue}</option>
              ))}
            </select>

            {/* Recent selection frequency — who's been playing */}
            {participationList.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                  Selected in last {last10Preview.length} matches
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {participationList.map(({ member, count }) => (
                    <span key={member.id} className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${
                      count >= 8 ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                      : count >= 5 ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                    }`}>
                      {member.name.split(' ')[0]}
                      <span className="opacity-60">{count}/{last10Preview.length}</span>
                    </span>
                  ))}
                </div>
                <p className="text-[9px] text-gray-400 mt-1">Green = 8–10 · Blue = 5–7 · Gray = 1–4 · Not shown = 0 (excluded)</p>
              </div>
            )}

            {(() => {
              const sel = matches.find(m => m.id === selectedMatch) || upcomingMatches[0];
              const hasSquad = (sel?.players?.length || 0) > 0;
              return (
                <Button onClick={() => handleSquadSelector()} disabled={loadingInsight.squad} className="w-full">
                  <Sparkles className="w-4 h-4 mr-2" />
                  {loadingInsight.squad
                    ? (hasSquad ? 'Analysing selected squad…' : 'AI is selecting best XI…')
                    : (hasSquad
                        ? `Analyse Selected Squad (${sel!.players!.length})`
                        : 'Generate Smart Best XI')}
                </Button>
              );
            })()}
          </Card>

          {/* AI Output */}
          {(insights.squad || loadingInsight.squad) && (
            <AIInsightCard
              title="AI Squad Selection"
              insight={insights.squad || null}
              loading={loadingInsight.squad || false}
              error={aiError}
              onRefresh={() => handleSquadSelector(true)}
            />
          )}

          {/* Match Prediction */}
          <Card className="p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary-500" />
              Match Prediction & Insights
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              AI analyses recent form + players selected in 3+ of last 10 matches + CricHeroes stats.
            </p>
            <Button onClick={() => handleMatchPrediction()} disabled={loadingInsight.prediction} variant="secondary" className="w-full">
              <Brain className="w-4 h-4 mr-2" />
              {loadingInsight.prediction ? 'Analysing…' : 'Predict Match Outcome'}
            </Button>
          </Card>
          {(insights.prediction || loadingInsight.prediction) && (
            <AIInsightCard
              title="Match Prediction"
              insight={insights.prediction || null}
              loading={loadingInsight.prediction || false}
              error={aiError}
              onRefresh={() => handleMatchPrediction(true)}
            />
          )}
        </div>
        );
      })()}

      {/* Cricket DNA Tab */}
      {activeTab === 'identity' && (
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary-500" />
              Personal Cricket Identity Cards
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Discover each player's unique cricket DNA — personality, strengths, and style. Shareable!
            </p>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Select Player</label>
              <select
                value={selectedMember}
                onChange={e => setSelectedMember(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm mb-3"
              >
                <option value="">Choose a player...</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <Button
                onClick={() => selectedMember && handleCricketDNA(selectedMember)}
                disabled={!selectedMember || loadingInsight[`dna_${selectedMember}`]}
                className="w-full"
              >
                <Zap className="w-4 h-4 mr-2" />
                {loadingInsight[`dna_${selectedMember}`] ? 'Analyzing DNA...' : 'Reveal Cricket DNA'}
              </Button>
            </div>
          </Card>

          {/* Show Identity Card */}
          {selectedMember && members.find(m => m.id === selectedMember) && (
            <CricketIdentityCard
              member={members.find(m => m.id === selectedMember)!}
              stats={stats.find(s => s.member_id === selectedMember) || null}
              dnaInsight={insights[`dna_${selectedMember}`] || null}
              loading={loadingInsight[`dna_${selectedMember}`] || false}
            />
          )}

          {/* Form Tracker */}
          {selectedMember && (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary-500" />
                  Form Tracker
                </h3>
                <Button
                  variant="secondary"
                  onClick={() => handleFormTracker(selectedMember)}
                  disabled={loadingInsight[`form_${selectedMember}`]}
                  className="text-xs"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Analyze
                </Button>
              </div>
              <AIInsightCard
                title="Current Form"
                insight={insights[`form_${selectedMember}`] || null}
                loading={loadingInsight[`form_${selectedMember}`] || false}
                error={null}
                onRefresh={() => handleFormTracker(selectedMember, true)}
              />
              {!insights[`form_${selectedMember}`] && !loadingInsight[`form_${selectedMember}`] && (
                <p className="text-sm text-gray-400 text-center py-3">Click Analyze to get form insights</p>
              )}
            </Card>
          )}

          {/* Training Recommendations */}
          {selectedMember && stats.find(s => s.member_id === selectedMember) && (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary-500" />
                  Training Recommendations
                </h3>
                <Button
                  variant="secondary"
                  onClick={() => {
                    const member = members.find(m => m.id === selectedMember);
                    const memberStats = stats.find(s => s.member_id === selectedMember);
                    generateSingleInsight(`training_${selectedMember}`, 'training_recommendations', {
                      member,
                      stats: memberStats,
                      weaknesses: [
                        (memberStats?.batting_average || 0) < 20 ? 'Low batting average' : null,
                        (memberStats?.bowling_economy || 0) > 8 ? 'High economy rate' : null,
                      ].filter(Boolean),
                    });
                  }}
                  disabled={loadingInsight[`training_${selectedMember}`]}
                  className="text-xs"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Get Plan
                </Button>
              </div>
              <AIInsightCard
                title="Personal Training Plan"
                insight={insights[`training_${selectedMember}`] || null}
                loading={loadingInsight[`training_${selectedMember}`] || false}
                error={null}
                onRefresh={() => {}}
              />
              {!insights[`training_${selectedMember}`] && !loadingInsight[`training_${selectedMember}`] && (
                <p className="text-sm text-gray-400 text-center py-3">Click Get Plan for personalized training advice</p>
              )}
            </Card>
          )}
        </div>
      )}

      {/* AI Chat Tab */}
      {activeTab === 'chat' && (
        <Card className="p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary-500" />
            SCC AI Assistant
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Ask anything about SCC — members, matches, stats, performance</p>

          {/* Chat Messages */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 min-h-48 max-h-96 overflow-y-auto mb-4 space-y-3">
            {chatMessages.length === 0 && (
              <div className="text-center py-6">
                <Bot className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">Ask me anything about SCC!</p>
                <div className="mt-3 flex flex-wrap gap-2 justify-center">
                  {[
                    'Who is our top scorer?',
                    'How many matches have we won this season?',
                    'Who should open batting?',
                    'What is our win rate?',
                  ].map(q => (
                    <button
                      key={q}
                      onClick={() => { setChatInput(q); }}
                      className="text-xs bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-full px-3 py-1 text-gray-600 dark:text-gray-300 hover:border-primary-400 hover:text-primary-600 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-primary-500 text-white rounded-tr-sm'
                    : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600 rounded-tl-sm'
                }`}>
                  {msg.role === 'ai' && <span className="text-xs text-gray-400 dark:text-gray-500 block mb-1">SCC AI</span>}
                  {msg.text}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl rounded-tl-sm px-4 py-2.5">
                  <div className="flex gap-1 items-center">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Chat Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleChat()}
              placeholder="Ask about SCC..."
              className="flex-1 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              disabled={chatLoading}
            />
            <Button onClick={handleChat} disabled={chatLoading || !chatInput.trim()} className="px-4">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
