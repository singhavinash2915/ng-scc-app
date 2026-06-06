import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { MatchChatMessage } from '../types';

export function useMatchChat(matchId: string) {
  const [messages, setMessages] = useState<MatchChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('match_chat')
        .select(`
          *,
          member:members(id, name, avatar_url)
        `)
        .eq('match_id', matchId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch chat messages');
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    if (!matchId) return;

    fetchMessages();

    // Subscribe to new messages in real-time
    const channel = supabase
      .channel(`match_chat:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'match_chat',
          filter: `match_id=eq.${matchId}`,
        },
        async (payload) => {
          // Fetch the full message with member join
          const { data } = await supabase
            .from('match_chat')
            .select(`
              *,
              member:members(id, name, avatar_url)
            `)
            .eq('id', payload.new.id)
            .single();

          if (data) {
            setMessages(prev => {
              // Avoid duplicates
              if (prev.some(m => m.id === data.id)) return prev;
              return [...prev, data];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, fetchMessages]);

  const sendMessage = async (
    memberId: string,
    message: string,
    emoji?: string
  ) => {
    try {
      const { data, error } = await supabase
        .from('match_chat')
        .insert([{
          match_id: matchId,
          member_id: memberId,
          message,
          emoji: emoji || null,
        }])
        .select(`
          *,
          member:members(id, name, avatar_url)
        `)
        .single();

      if (error) throw error;

      // Add optimistically (real-time will deduplicate)
      setMessages(prev => {
        if (prev.some(m => m.id === data.id)) return prev;
        return [...prev, data];
      });

      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to send message');
    }
  };

  const deleteMessage = async (id: string) => {
    try {
      const { error } = await supabase
        .from('match_chat')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setMessages(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete message');
    }
  };

  return {
    messages,
    loading,
    error,
    sendMessage,
    deleteMessage,
  };
}
