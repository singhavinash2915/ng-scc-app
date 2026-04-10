import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { AIInsightType } from '../types';

const SUPABASE_URL = 'https://zrrmpaatydhlkntfpcmw.supabase.co';
const CACHE_TTL_HOURS = 24;

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
      const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpycm1wYWF0eWRobGtudGZwY213Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyMTIzNDcsImV4cCI6MjA4Mjc4ODM0N30.kHot4i6MNPjt2neNzJ_tMAplJi_9CiYNgFzAzmEgdeg';

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
        expiresAt.setHours(expiresAt.getHours() + CACHE_TTL_HOURS);

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
