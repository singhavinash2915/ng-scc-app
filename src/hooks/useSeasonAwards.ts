import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { SeasonAwardCategory, SeasonAwardVote } from '../types';

export function useSeasonAwards(season: string = '2025-26') {
  const [categories, setCategories] = useState<SeasonAwardCategory[]>([]);
  const [votes, setVotes] = useState<SeasonAwardVote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('season_award_categories')
        .select('*')
        .eq('season', season)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch award categories');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [season]);

  const fetchVotes = useCallback(async () => {
    try {
      // Fetch votes for all active categories in this season
      const { data: cats } = await supabase
        .from('season_award_categories')
        .select('id')
        .eq('season', season)
        .eq('is_active', true);

      if (!cats || cats.length === 0) {
        setVotes([]);
        return;
      }

      const categoryIds = cats.map(c => c.id);
      const { data, error } = await supabase
        .from('season_award_votes')
        .select('*')
        .in('category_id', categoryIds);

      if (error) throw error;
      setVotes(data || []);
    } catch (err) {
      // Gracefully handle missing table
      setVotes([]);
    }
  }, [season]);

  useEffect(() => {
    fetchCategories();
    fetchVotes();
  }, [fetchCategories, fetchVotes]);

  const createCategory = async (name: string, emoji?: string) => {
    try {
      const { data, error } = await supabase
        .from('season_award_categories')
        .insert([{
          name,
          emoji: emoji || null,
          season,
          is_active: true,
        }])
        .select()
        .single();

      if (error) throw error;
      setCategories(prev => [...prev, data]);
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to create award category');
    }
  };

  const vote = async (categoryId: string, voterId: string, nomineeId: string) => {
    try {
      const { data, error } = await supabase
        .from('season_award_votes')
        .upsert(
          {
            category_id: categoryId,
            voter_id: voterId,
            nominee_id: nomineeId,
          },
          { onConflict: 'category_id,voter_id' }
        )
        .select()
        .single();

      if (error) throw error;

      // Update local votes state
      setVotes(prev => {
        const filtered = prev.filter(
          v => !(v.category_id === categoryId && v.voter_id === voterId)
        );
        return [...filtered, data];
      });

      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to submit vote');
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      const { error } = await supabase
        .from('season_award_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setCategories(prev => prev.filter(c => c.id !== id));
      setVotes(prev => prev.filter(v => v.category_id !== id));
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete award category');
    }
  };

  const getResults = (categoryId: string): { nominee_id: string; count: number }[] => {
    const categoryVotes = votes.filter(v => v.category_id === categoryId);
    const counts = new Map<string, number>();

    for (const v of categoryVotes) {
      counts.set(v.nominee_id, (counts.get(v.nominee_id) || 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([nominee_id, count]) => ({ nominee_id, count }))
      .sort((a, b) => b.count - a.count);
  };

  return {
    categories,
    votes,
    loading,
    error,
    createCategory,
    vote,
    deleteCategory,
    getResults,
  };
}
