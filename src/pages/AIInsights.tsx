import { useState } from 'react';
import { Sparkles, Brain, Users, TrendingUp, MessageSquare, Trophy, Target, Zap, ChevronRight, RefreshCw, Bot, Send } from 'lucide-react';
import { useMembers } from '../hooks/useMembers';
import { useMatches } from '../hooks/useMatches';
import { useCricketStats } from '../hooks/useCricketStats';
import { useAIInsight } from '../hooks/useAIInsight';
import { AIInsightCard } from '../components/AIInsightCard';
import { CricketIdentityCard } from '../components/CricketIdentityCard';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

type Tab = 'overview' | 'squad' | 'identity' | 'chat' | 'leaderboard';

export function AIInsights() {
  const { members } = useMembers();
  const { matches } = useMatches();
  const { stats, getLeaderboard } = useCricketStats();
  const { generateInsight, error: aiError } = useAIInsight();

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

  const generateSingleInsight = async (key: string, type: Parameters<typeof generateInsight>[0], data: Record<string, unknown>) => {
    setLoadingInsight(prev => ({ ...prev, [key]: true }));
    const result = await generateInsight(type, data);
    setInsights(prev => ({ ...prev, [key]: result }));
    setLoadingInsight(prev => ({ ...prev, [key]: false }));
  };

  const handleSquadSelector = () => {
    const match = matches.find(m => m.id === selectedMatch);
    const availableMembers = members.map(m => {
      const s = stats.find(st => st.member_id === m.id);
      return {
        name: m.name,
        matches_played: m.matches_played,
        batting_avg: s?.batting_average || 0,
        batting_runs: s?.batting_runs || 0,
        bowling_wickets: s?.bowling_wickets || 0,
        bowling_economy: s?.bowling_economy || 0,
      };
    });
    generateSingleInsight('squad', 'squad_selector', { match, players: availableMembers });
  };

  const handleMatchPrediction = () => {
    const match = matches.find(m => m.id === selectedMatch);
    const squadStats = stats.slice(0, 15).map(s => ({
      name: s.member?.name,
      batting_avg: s.batting_average,
      bowling_wickets: s.bowling_wickets,
    }));
    const recentForm = recentMatches.slice(0, 5).map(m => ({ result: m.result, opponent: m.opponent, venue: m.venue }));
    generateSingleInsight('prediction', 'match_prediction', { match, squadStats, recentForm });
  };

  const handleCricketDNA = async (memberId: string) => {
    const member = members.find(m => m.id === memberId);
    const memberStats = stats.find(s => s.member_id === memberId);
    if (!member) return;
    const key = `dna_${memberId}`;
    generateSingleInsight(key, 'cricket_dna', { member, stats: memberStats || {} });
  };

  const handleLeaderboardCommentary = () => {
    const lb = leaderboard.slice(0, 10).map((s, i) => ({
      rank: i + 1,
      name: s.member?.name,
      runs: s.batting_runs,
      wickets: s.bowling_wickets,
      matches: s.batting_matches,
      average: s.batting_average,
    }));
    const won = recentMatches.filter(m => m.result === 'won').length;
    generateSingleInsight('leaderboard', 'leaderboard_commentary', {
      leaderboard: lb,
      summary: `SCC played ${recentMatches.length} matches, won ${won}. Win rate: ${recentMatches.length > 0 ? Math.round(won / recentMatches.length * 100) : 0}%`,
    });
  };

  const handleFormTracker = (memberId: string) => {
    const member = members.find(m => m.id === memberId);
    const memberStats = stats.find(s => s.member_id === memberId);
    const memberMatches = recentMatches.filter(m => m.players?.some(p => p.member_id === memberId)).slice(0, 5);
    generateSingleInsight(`form_${memberId}`, 'form_tracker', {
      member,
      stats: memberStats || {},
      recentMatches: memberMatches.map(m => ({ date: m.date, result: m.result, opponent: m.opponent })),
      careerAverage: memberStats?.batting_average || 0,
    });
  };

  const handleChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatLoading(true);

    const clubStats = {
      totalMembers: members.length,
      activeMembers: members.filter(m => m.status === 'active').length,
      matchesPlayed: recentMatches.length,
      wins: recentMatches.filter(m => m.result === 'won').length,
      topScorer: leaderboard[0]?.member?.name || 'N/A',
    };

    const result = await generateInsight('club_chat', {
      question: userMsg,
      members: members.map(m => ({ name: m.name, matches_played: m.matches_played, balance: m.balance })),
      recentMatches: recentMatches.map(m => ({ date: m.date, result: m.result, opponent: m.opponent, venue: m.venue })),
      stats: clubStats,
    });

    setChatMessages(prev => [...prev, { role: 'ai', text: result || 'Sorry, I could not generate a response.' }]);
    setChatLoading(false);
  };

  const tabs: Array<{ id: Tab; label: string; icon: typeof Sparkles }> = [
    { id: 'overview', label: 'Overview', icon: Sparkles },
    { id: 'squad', label: 'Squad AI', icon: Users },
    { id: 'identity', label: 'Cricket DNA', icon: Zap },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    { id: 'chat', label: 'AI Chat', icon: MessageSquare },
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
                  { label: 'Season Leaderboard', desc: 'AI-powered commentary', tab: 'leaderboard' as Tab },
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
                  onClick={() => generateSingleInsight('match_report', 'match_report', {
                    match: recentMatches[0],
                    players: recentMatches[0].players?.map(p => ({ name: p.member?.name, team: p.team })),
                  })}
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
                onRefresh={() => generateSingleInsight('match_report', 'match_report', {
                  match: recentMatches[0],
                  players: recentMatches[0].players?.map(p => ({ name: p.member?.name, team: p.team })),
                })}
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
      {activeTab === 'squad' && (
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary-500" />
              AI Squad Selector
            </h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Select Match (optional)</label>
                <select
                  value={selectedMatch}
                  onChange={e => setSelectedMatch(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm"
                >
                  <option value="">Any upcoming match</option>
                  {upcomingMatches.map(m => (
                    <option key={m.id} value={m.id}>{m.date} — {m.opponent || 'TBD'} at {m.venue}</option>
                  ))}
                </select>
              </div>
              <Button onClick={handleSquadSelector} disabled={loadingInsight.squad} className="w-full">
                <Sparkles className="w-4 h-4 mr-2" />
                {loadingInsight.squad ? 'AI is selecting...' : 'Generate Best XI'}
              </Button>
            </div>
            <AIInsightCard
              title="AI Squad Selection"
              insight={insights.squad || null}
              loading={loadingInsight.squad || false}
              error={aiError}
              onRefresh={handleSquadSelector}
            />
          </Card>

          {/* Match Prediction */}
          <Card className="p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary-500" />
              Match Prediction
            </h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Select Upcoming Match</label>
                <select
                  value={selectedMatch}
                  onChange={e => setSelectedMatch(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm"
                >
                  <option value="">Select a match...</option>
                  {upcomingMatches.map(m => (
                    <option key={m.id} value={m.id}>{m.date} — {m.opponent || 'TBD'} at {m.venue}</option>
                  ))}
                </select>
              </div>
              <Button onClick={handleMatchPrediction} disabled={loadingInsight.prediction} variant="secondary" className="w-full">
                <Brain className="w-4 h-4 mr-2" />
                {loadingInsight.prediction ? 'Predicting...' : 'Predict Match Outcome'}
              </Button>
            </div>
            <AIInsightCard
              title="Match Prediction"
              insight={insights.prediction || null}
              loading={loadingInsight.prediction || false}
              error={aiError}
              onRefresh={handleMatchPrediction}
            />
          </Card>
        </div>
      )}

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
                onRefresh={() => handleFormTracker(selectedMember)}
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

      {/* Leaderboard Tab */}
      {activeTab === 'leaderboard' && (
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                Season 2026-27 Leaderboard
              </h3>
              <Button onClick={handleLeaderboardCommentary} disabled={loadingInsight.leaderboard} className="text-xs">
                <Sparkles className="w-3.5 h-3.5 mr-1" />
                AI Commentary
              </Button>
            </div>

            {/* AI Commentary */}
            {(insights.leaderboard || loadingInsight.leaderboard) && (
              <AIInsightCard
                title="Season AI Commentary"
                insight={insights.leaderboard || null}
                loading={loadingInsight.leaderboard || false}
                error={null}
                className="mb-4"
                onRefresh={handleLeaderboardCommentary}
              />
            )}

            {/* Leaderboard Table */}
            {leaderboard.length > 0 ? (
              <div className="space-y-2">
                {leaderboard.map((s, index) => (
                  <div key={s.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                    index === 0 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' :
                    index === 1 ? 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700' :
                    index === 2 ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' :
                    'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'
                  }`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      index === 0 ? 'bg-amber-400 text-white' :
                      index === 1 ? 'bg-gray-400 text-white' :
                      index === 2 ? 'bg-orange-400 text-white' :
                      'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                    }`}>
                      {index < 3 ? ['1','2','3'][index] : index + 1}
                    </div>
                    {s.member?.avatar_url ? (
                      <img src={s.member.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-sm">
                        {s.member?.name?.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{s.member?.name}</p>
                      <p className="text-xs text-gray-500">{s.batting_matches}M · {s.batting_runs}R · {s.bowling_wickets}W</p>
                    </div>
                    <button
                      onClick={() => { setSelectedMember(s.member_id); setActiveTab('identity'); handleCricketDNA(s.member_id); }}
                      className="text-xs text-primary-500 hover:text-primary-700 font-medium whitespace-nowrap"
                    >
                      DNA
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No stats loaded yet</p>
                <p className="text-gray-400 text-sm mt-1">Import cricket stats data in Settings</p>
              </div>
            )}
          </Card>
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
