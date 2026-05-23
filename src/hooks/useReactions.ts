import { useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export const REACTION_EMOJIS = ['🔥', '🏆', '💪', '😬', '👏'] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export interface ReactionCount {
  emoji: ReactionEmoji;
  count: number;
  reacted: boolean;
}

const defaultCounts = (): ReactionCount[] =>
  REACTION_EMOJIS.map(emoji => ({ emoji, count: 0, reacted: false }));

export function useReactions(entityType: string, entityId: string, memberId?: string | null) {
  const [counts, setCounts] = useState<ReactionCount[]>(defaultCounts);
  const [loading, setLoading] = useState(false);
  // Keep a ref to the latest counts so toggle() can read them without stale closure
  const countsRef = useRef(counts);
  countsRef.current = counts;

  const fetch = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('reactions')
        .select('emoji, member_id')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId);
      if (data) {
        setCounts(
          REACTION_EMOJIS.map(emoji => ({
            emoji,
            count: data.filter(r => r.emoji === emoji).length,
            reacted: memberId
              ? data.some(r => r.emoji === emoji && r.member_id === memberId)
              : false,
          }))
        );
      }
    } catch { /* non-critical */ } finally {
      setLoading(false);
    }
  }, [entityType, entityId, memberId]);

  const toggle = async (emoji: ReactionEmoji) => {
    if (!memberId) return;
    const current = countsRef.current.find(r => r.emoji === emoji);
    const wasReacted = current?.reacted ?? false;

    // Optimistic update
    setCounts(prev =>
      prev.map(r =>
        r.emoji === emoji
          ? { ...r, reacted: !wasReacted, count: r.count + (wasReacted ? -1 : 1) }
          : r
      )
    );

    try {
      if (wasReacted) {
        await supabase
          .from('reactions')
          .delete()
          .eq('entity_type', entityType)
          .eq('entity_id', entityId)
          .eq('emoji', emoji)
          .eq('member_id', memberId);
      } else {
        await supabase.from('reactions').upsert(
          { entity_type: entityType, entity_id: entityId, emoji, member_id: memberId },
          { onConflict: 'entity_type,entity_id,member_id,emoji' }
        );
      }
    } catch {
      // Revert on error
      await fetch();
    }
  };

  return { counts, loading, fetch, toggle };
}
