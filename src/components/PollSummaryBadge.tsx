import { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { useMatchPolls } from '../hooks/useMatchPolls';
import type { Member } from '../types';

interface PollSummaryBadgeProps {
  matchId: string;
  members: Member[];
  onClick?: () => void;
}

export function PollSummaryBadge({ matchId, members, onClick }: PollSummaryBadgeProps) {
  const { fetchPollsByMatch, getPollSummary } = useMatchPolls();
  const [summary, setSummary] = useState({ available: 0, unavailable: 0, maybe: 0, noResponse: 0, total: 0 });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      const polls = await fetchPollsByMatch(matchId);
      setSummary(getPollSummary(polls, members.length));
      setLoaded(true);
    };
    load();
  }, [matchId, members.length, fetchPollsByMatch, getPollSummary]);

  if (!loaded) return null;

  const totalResponses = summary.available + summary.maybe + summary.unavailable;
  if (totalResponses === 0) {
    return (
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
      >
        <BarChart3 className="w-3 h-3" />
        No responses yet
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-xs font-medium"
    >
      {summary.available > 0 && (
        <span className="text-green-600 dark:text-green-400">✅ {summary.available}</span>
      )}
      {summary.maybe > 0 && (
        <span className="text-amber-600 dark:text-amber-400">🤔 {summary.maybe}</span>
      )}
      {summary.unavailable > 0 && (
        <span className="text-red-600 dark:text-red-400">❌ {summary.unavailable}</span>
      )}
      {summary.noResponse > 0 && (
        <span className="text-gray-400">⏳ {summary.noResponse}</span>
      )}
    </button>
  );
}
