import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Announcement } from '../types';

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });
    // Gracefully handle missing table (table doesn't exist until migration runs)
    if (error) {
      setError(null);
      setAnnouncements([]);
    } else {
      setAnnouncements(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addAnnouncement = async (a: Omit<Announcement, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
      .from('announcements')
      .insert([a])
      .select()
      .single();
    if (error) throw error;
    await fetchAll();
    return data;
  };

  const updateAnnouncement = async (id: string, updates: Partial<Announcement>) => {
    const { error } = await supabase.from('announcements').update(updates).eq('id', id);
    if (error) throw error;
    await fetchAll();
  };

  const deleteAnnouncement = async (id: string) => {
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) throw error;
    setAnnouncements(prev => prev.filter(a => a.id !== id));
  };

  return { announcements, loading, error, fetchAll, addAnnouncement, updateAnnouncement, deleteAnnouncement };
}
