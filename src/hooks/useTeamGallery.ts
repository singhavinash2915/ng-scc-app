import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Curated team-photo gallery shown on the Dashboard carousel.
 *
 * Admin uploads photos from Settings. Photos are stored as a simple list of
 * public URLs in the `app_configs` table under the `team_gallery` key —
 * same pattern the ground photos & UPI settings already use.
 */

const TEAM_GALLERY_KEY = 'team_gallery';

export interface TeamGalleryPhoto {
  url: string;          // public Supabase storage URL
  caption?: string;     // optional admin-supplied caption
  uploaded_at: string;  // ISO timestamp
}

export interface TeamGallery {
  photos: TeamGalleryPhoto[];
}

const defaultGallery: TeamGallery = { photos: [] };

export function useTeamGallery() {
  const [gallery, setGallery] = useState<TeamGallery>(defaultGallery);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGallery = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('app_configs')
        .select('value')
        .eq('key', TEAM_GALLERY_KEY)
        .maybeSingle();
      if (err) throw err;
      const saved = (data?.value as Partial<TeamGallery> | null) || null;
      setGallery({
        photos: Array.isArray(saved?.photos) ? saved.photos : [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team gallery');
      setGallery(defaultGallery);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGallery();
  }, [fetchGallery]);

  const save = async (next: TeamGallery): Promise<boolean> => {
    setSaving(true);
    try {
      const { error: err } = await supabase
        .from('app_configs')
        .upsert(
          { key: TEAM_GALLERY_KEY, value: next as unknown as Record<string, unknown> },
          { onConflict: 'key' },
        );
      if (err) throw err;
      setGallery(next);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save team gallery');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const uploadPhoto = async (file: File): Promise<string | null> => {
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `team-gallery/team-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('sponsors')        // reuse public sponsors bucket — same as ground photos
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('sponsors').getPublicUrl(path);
      return publicUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo upload failed');
      return null;
    }
  };

  const addPhoto = async (file: File, caption?: string): Promise<boolean> => {
    const url = await uploadPhoto(file);
    if (!url) return false;
    const newPhoto: TeamGalleryPhoto = {
      url,
      caption: caption?.trim() || undefined,
      uploaded_at: new Date().toISOString(),
    };
    return save({ photos: [newPhoto, ...gallery.photos] });
  };

  const removePhoto = async (url: string): Promise<boolean> => {
    const next = { photos: gallery.photos.filter(p => p.url !== url) };
    return save(next);
  };

  const updateCaption = async (url: string, caption: string): Promise<boolean> => {
    const next = {
      photos: gallery.photos.map(p =>
        p.url === url ? { ...p, caption: caption.trim() || undefined } : p
      ),
    };
    return save(next);
  };

  const reorderPhotos = async (urls: string[]): Promise<boolean> => {
    // Reorder gallery to match the given URL sequence; unknown URLs are dropped.
    const lookup: Record<string, TeamGalleryPhoto> = {};
    for (const p of gallery.photos) lookup[p.url] = p;
    const next: TeamGallery = {
      photos: urls.map(u => lookup[u]).filter(Boolean),
    };
    return save(next);
  };

  return {
    gallery,
    loading,
    saving,
    error,
    fetchGallery,
    addPhoto,
    removePhoto,
    updateCaption,
    reorderPhotos,
  };
}
