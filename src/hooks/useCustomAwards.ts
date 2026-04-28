import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { CustomAward } from '../types';

export function useCustomAwards(season = '2025-26') {
  const [awards, setAwards] = useState<CustomAward[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('custom_awards')
      .select('*, member:members(id, name, avatar_url)')
      .eq('season', season)
      .order('awarded_at', { ascending: false });
    // Gracefully handle missing table (table doesn't exist until migration runs)
    if (error) {
      setAwards([]);
    } else {
      setAwards((data as CustomAward[]) || []);
    }
    setLoading(false);
  }, [season]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addAward = async (a: Omit<CustomAward, 'id' | 'created_at' | 'member'>) => {
    const { data, error } = await supabase.from('custom_awards').insert([a]).select().single();
    if (error) throw error;
    await fetchAll();
    return data;
  };

  const deleteAward = async (id: string) => {
    const { error } = await supabase.from('custom_awards').delete().eq('id', id);
    if (error) throw error;
    setAwards(prev => prev.filter(a => a.id !== id));
  };

  return { awards, loading, fetchAll, addAward, deleteAward };
}
