import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { AIInsightType } from '../types';

const SUPABASE_URL = 'https://nptvrfqonfmafvbzjrih.supabase.co';

// Squad/prediction insights change when poll responses come in — short TTL
// Other insights (DNA, match report) are stable — use full 24h TTL
function cacheTTL(type: AIInsightType): number {
  if (type === 'squad_selector' || type === 'match_prediction') return 2;
  return 24;
}

export function useAIInsight() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateInsight = useCallback(async (
    type: AIInsightType,
    data: Record<string, unknown>,
    cacheKey?: string
  ): Promise<string | null> => {
    setLoading(true);
    setError(null);

    try {
      // Check cache first if cacheKey provided
      if (cacheKey) {
        const { data: cached } = await supabase
          .from('ai_insight_cache')
          .select('content, expires_at')
          .eq('cache_key', cacheKey)
          .single();

        if (cached && new Date(cached.expires_at) > new Date()) {
          return cached.content;
        }
      }

      // Get anon key from supabase client
      const anonKey = 'sb_publishable_NC3gqU5FnEFEhSO9KWPKNg_WpLnfo9G';

      const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-insights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ type, data }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `AI service error: ${response.status}`);
      }

      const result = await response.json();
      const content = result.content;

      // Cache the result if cacheKey provided
      if (cacheKey && content) {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + cacheTTL(type));

        await supabase.from('ai_insight_cache').upsert({
          cache_key: cacheKey,
          insight_type: type,
          content,
          expires_at: expiresAt.toISOString(),
        }, { onConflict: 'cache_key' });
      }

      return content;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate AI insight';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { generateInsight, loading, error };
}
