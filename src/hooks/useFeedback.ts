import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Feedback } from '../types';

export function useFeedback() {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeedback = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFeedback(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch feedback');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const submitFeedback = async (data: {
    name: string;
    message: string;
    rating?: number;
  }) => {
    try {
      const { data: result, error } = await supabase
        .from('feedback')
        .insert([{
          name: data.name,
          message: data.message,
          rating: data.rating || null,
        }])
        .select()
        .single();

      if (error) throw error;
      setFeedback(prev => [result, ...prev]);
      return result;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to submit feedback');
    }
  };

  const replyToFeedback = async (id: string, reply: string) => {
    try {
      const { data, error } = await supabase
        .from('feedback')
        .update({
          admin_reply: reply,
          replied_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setFeedback(prev => prev.map(f => f.id === id ? data : f));
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to reply to feedback');
    }
  };

  const deleteFeedback = async (id: string) => {
    try {
      const { error } = await supabase
        .from('feedback')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setFeedback(prev => prev.filter(f => f.id !== id));
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete feedback');
    }
  };

  return {
    feedback,
    loading,
    error,
    fetchFeedback,
    submitFeedback,
    replyToFeedback,
    deleteFeedback,
  };
}
