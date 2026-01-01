import { useMemo } from 'react';
import {
  Trophy,
  Target,
  TrendingUp,
  Calendar,
  Award,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Header } from '../components/layout/Header';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useMatches } from '../hooks/useMatches';
import { useMembers } from '../hooks/useMembers';

const COLORS = {
  won: '#10b981',
  lost: '#ef4444',
  draw: '#f59e0b',
};

export function Analytics() {
  const { matches, loading: matchesLoading } = useMatches();
  const { members, loading: membersLoading } = useMembers();

  const stats = useMemo(() => {
    const completedMatches = matches.filter(m => ['won', 'lost', 'draw'].includes(m.result));
    const won = completedMatches.filter(m => m.result === 'won').length;
    const lost = completedMatches.filter(m => m.result === 'lost').length;
    const draw = completedMatches.filter(m => m.result === 'draw').length;
    const winRate = completedMatches.length > 0 ? (won / completedMatches.length) * 100 : 0;

    return {
      total: completedMatches.length,
      won,
      lost,
      draw,
      winRate,
    };
  }, [matches]);

  const pieData = useMemo(() => [
    { name: 'Won', value: stats.won, color: COLORS.won },
    { name: 'Lost', value: stats.lost, color: COLORS.lost },
    { name: 'Draw', value: stats.draw, color: COLORS.draw },
  ], [stats]);

  const last5Matches = useMemo(() => {
    return matches
      .filter(m => ['won', 'lost', 'draw'].includes(m.result))
      .slice(0, 5)
      .reverse();
  }, [matches]);

  const monthlyData = useMemo(() => {
    const monthlyStats: Record<string, { month: string; won: number; lost: number; draw: number }> = {};

    matches
      .filter(m => ['won', 'lost', 'draw'].includes(m.result))
      .forEach(match => {
        const date = new Date(match.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });

        if (!monthlyStats[monthKey]) {
          monthlyStats[monthKey] = { month: monthName, won: 0, lost: 0, draw: 0 };
        }

        if (match.result === 'won') monthlyStats[monthKey].won++;
        else if (match.result === 'lost') monthlyStats[monthKey].lost++;
        else if (match.result === 'draw') monthlyStats[monthKey].draw++;
      });

    return Object.values(monthlyStats).slice(-6);
  }, [matches]);

  const topPlayers = useMemo(() => {
    return [...members]
      .sort((a, b) => b.matches_played - a.matches_played)
      .slice(0, 5);
  }, [members]);

  const loading = matchesLoading || membersLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Analytics" subtitle="Match statistics and performance insights" />

      <div className="p-4 lg:p-8 space-y-6">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                  <Calendar className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Matches</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                  <Trophy className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Wins</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.won}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl">
                  <Target className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Losses</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.lost}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl">
                  <TrendingUp className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Win Rate</p>
                  <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {stats.winRate.toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Win/Loss Pie Chart */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-gray-900 dark:text-white">Match Results</h3>
            </CardHeader>
            <CardContent>
              {stats.total === 0 ? (
                <div className="h-64 flex items-center justify-center text-gray-500">
                  No match data available
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="flex justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Won</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Lost</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Draw</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Last 5 Matches */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-gray-900 dark:text-white">Recent Form</h3>
            </CardHeader>
            <CardContent>
              {last5Matches.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-gray-500">
                  No match data available
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-center gap-2 mb-6">
                    {last5Matches.map((match) => (
                      <div
                        key={match.id}
                        className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg ${
                          match.result === 'won'
                            ? 'bg-green-500'
                            : match.result === 'lost'
                            ? 'bg-red-500'
                            : 'bg-yellow-500'
                        }`}
                      >
                        {match.result === 'won' ? 'W' : match.result === 'lost' ? 'L' : 'D'}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    {last5Matches.reverse().map(match => (
                      <div key={match.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            vs {match.opponent || 'TBD'}
                          </p>
                          <p className="text-sm text-gray-500">
                            {new Date(match.date).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </p>
                        </div>
                        <Badge
                          variant={
                            match.result === 'won'
                              ? 'success'
                              : match.result === 'lost'
                              ? 'danger'
                              : 'warning'
                          }
                        >
                          {match.result.toUpperCase()}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Monthly Trend */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900 dark:text-white">Monthly Performance</h3>
          </CardHeader>
          <CardContent>
            {monthlyData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-500">
                No match data available
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                    <XAxis dataKey="month" className="text-gray-600 dark:text-gray-400" />
                    <YAxis allowDecimals={false} className="text-gray-600 dark:text-gray-400" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--tooltip-bg)',
                        border: 'none',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="won" name="Won" fill={COLORS.won} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="lost" name="Lost" fill={COLORS.lost} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="draw" name="Draw" fill={COLORS.draw} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Players */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-yellow-500" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Top Players by Participation</h3>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {topPlayers.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No player data available</div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {topPlayers.map((player, index) => (
                  <div key={player.id} className="px-6 py-4 flex items-center gap-4">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0
                          ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
                          : index === 1
                          ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                          : index === 2
                          ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">{player.name}</p>
                      <p className="text-sm text-gray-500">{player.matches_played} matches</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Balance</p>
                      <p className={`font-semibold ${player.balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        ₹{player.balance.toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
