import { useState } from 'react';
import { Sparkles, RefreshCw, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface AIInsightCardProps {
  title: string;
  insight: string | null;
  loading: boolean;
  error: string | null;
  onRefresh?: () => void;
  className?: string;
  compact?: boolean;
}

export function AIInsightCard({ title, insight, loading, error, onRefresh, className = '', compact = false }: AIInsightCardProps) {
  const [expanded, setExpanded] = useState(!compact);

  if (loading) {
    return (
      <div className={`bg-gradient-to-br from-primary-50 to-emerald-50 dark:from-primary-900/20 dark:to-emerald-900/20 rounded-xl p-4 border border-primary-200 dark:border-primary-800 ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-primary-500 animate-pulse" />
          <span className="text-sm font-semibold text-primary-700 dark:text-primary-300">{title}</span>
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-primary-200 dark:bg-primary-700 rounded animate-pulse" />
          <div className="h-3 bg-primary-200 dark:bg-primary-700 rounded animate-pulse w-4/5" />
          <div className="h-3 bg-primary-200 dark:bg-primary-700 rounded animate-pulse w-3/5" />
        </div>
        <p className="text-xs text-primary-500 mt-2 italic">AI is thinking...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800 ${className}`}>
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">{title}</span>
        </div>
        <p className="text-xs text-amber-600 dark:text-amber-400">{error.includes('not configured') ? 'AI service not configured yet. Add ANTHROPIC_API_KEY to Supabase secrets.' : error}</p>
        {onRefresh && (
          <button onClick={onRefresh} className="mt-2 text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Try again
          </button>
        )}
      </div>
    );
  }

  if (!insight) return null;

  return (
    <div className={`bg-gradient-to-br from-primary-50 to-emerald-50 dark:from-primary-900/20 dark:to-emerald-900/20 rounded-xl border border-primary-200 dark:border-primary-800 overflow-hidden ${className}`}>
      <div
        className={`flex items-center justify-between p-4 ${compact ? 'cursor-pointer' : ''}`}
        onClick={compact ? () => setExpanded(!expanded) : undefined}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary-500" />
          <span className="text-sm font-semibold text-primary-700 dark:text-primary-300">{title}</span>
          <span className="text-xs bg-primary-100 dark:bg-primary-800 text-primary-600 dark:text-primary-300 px-2 py-0.5 rounded-full">AI</span>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button onClick={(e) => { e.stopPropagation(); onRefresh(); }} className="p-1 hover:bg-primary-100 dark:hover:bg-primary-800 rounded-lg transition-colors" title="Refresh">
              <RefreshCw className="w-3.5 h-3.5 text-primary-500" />
            </button>
          )}
          {compact && (
            expanded ? <ChevronUp className="w-4 h-4 text-primary-500" /> : <ChevronDown className="w-4 h-4 text-primary-500" />
          )}
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4">
          <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
            {insight}
          </div>
        </div>
      )}
    </div>
  );
}
