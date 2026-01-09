import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { MatchPhoto } from '../types';

// Configuration: Keep photos from only the last N matches
const MAX_MATCHES_WITH_PHOTOS = 5;

export function useMatchPhotos() {
  const [photos, setPhotos] = useState<MatchPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Clean up old photos - keep only photos from last N matches
  const cleanupOldPhotos = useCallback(async () => {
    try {
      // Get unique match IDs sorted by match date (newest first)
      const { data: recentMatches, error: matchError } = await supabase
        .from('matches')
        .select('id')
        .order('date', { ascending: false });

      if (matchError) throw matchError;

      const recentMatchIds = recentMatches?.slice(0, MAX_MATCHES_WITH_PHOTOS).map(m => m.id) || [];

      if (recentMatchIds.length === 0) return;

      // Get photos from older matches (not in the recent list)
      const { data: oldPhotos, error: photoError } = await supabase
        .from('match_photos')
        .select('id, photo_url, match_id')
        .not('match_id', 'in', `(${recentMatchIds.join(',')})`);

      if (photoError) throw photoError;

      if (!oldPhotos || oldPhotos.length === 0) return;

      // Delete old photos from storage and database
      for (const photo of oldPhotos) {
        const fileName = photo.photo_url.split('/').pop();
        if (fileName) {
          await supabase.storage.from('match-photos').remove([`photos/${fileName}`]);
        }
      }

      // Delete all old photo records
      const oldPhotoIds = oldPhotos.map(p => p.id);
      await supabase
        .from('match_photos')
        .delete()
        .in('id', oldPhotoIds);

      console.log(`Cleaned up ${oldPhotos.length} old photos`);
    } catch (err) {
      console.error('Failed to cleanup old photos:', err);
    }
  }, []);

  const fetchPhotos = useCallback(async () => {
    try {
      setLoading(true);

      // First, cleanup old photos
      await cleanupOldPhotos();

      // Then fetch remaining photos
      const { data, error } = await supabase
        .from('match_photos')
        .select(`
          *,
          match:matches(id, date, venue, opponent, result, our_score, opponent_score)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPhotos(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch photos');
    } finally {
      setLoading(false);
    }
  }, [cleanupOldPhotos]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  const uploadPhoto = async (matchId: string, file: File, caption?: string) => {
    try {
      // Generate unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${matchId}-${Date.now()}.${fileExt}`;
      const filePath = `photos/${fileName}`;

      // Upload photo to storage
      const { error: uploadError } = await supabase.storage
        .from('match-photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('match-photos')
        .getPublicUrl(filePath);

      // Create database record
      const { data, error: dbError } = await supabase
        .from('match_photos')
        .insert([{
          match_id: matchId,
          photo_url: publicUrl,
          caption: caption || null,
        }])
        .select(`
          *,
          match:matches(id, date, venue, opponent, result, our_score, opponent_score)
        `)
        .single();

      if (dbError) throw dbError;

      setPhotos(prev => [data, ...prev]);
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to upload photo');
    }
  };

  const deletePhoto = async (photoId: string) => {
    try {
      const photo = photos.find(p => p.id === photoId);
      if (!photo) throw new Error('Photo not found');

      // Delete from storage
      const fileName = photo.photo_url.split('/').pop();
      if (fileName) {
        await supabase.storage.from('match-photos').remove([`photos/${fileName}`]);
      }

      // Delete from database
      const { error } = await supabase
        .from('match_photos')
        .delete()
        .eq('id', photoId);

      if (error) throw error;

      setPhotos(prev => prev.filter(p => p.id !== photoId));
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete photo');
    }
  };

  const getPhotosByMatch = (matchId: string) => {
    return photos.filter(p => p.match_id === matchId);
  };

  const getRecentPhotos = (limit: number = 10) => {
    return photos.slice(0, limit);
  };

  return {
    photos,
    loading,
    error,
    fetchPhotos,
    uploadPhoto,
    deletePhoto,
    getPhotosByMatch,
    getRecentPhotos,
  };
}
