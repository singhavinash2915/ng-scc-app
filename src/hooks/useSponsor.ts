import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Sponsor } from '../types';

export function useSponsor() {
  const [sponsor, setSponsor] = useState<Sponsor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSponsor = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sponsors')
        .select('*, member:members(id, name, avatar_url)')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setSponsor(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sponsor');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSponsor();
  }, [fetchSponsor]);

  const saveSponsor = async (sponsorData: {
    name: string;
    tagline?: string | null;
    description?: string | null;
    website_url?: string | null;
    member_id?: string | null;
  }) => {
    try {
      if (sponsor) {
        const { data, error } = await supabase
          .from('sponsors')
          .update({
            ...sponsorData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sponsor.id)
          .select('*, member:members(id, name, avatar_url)')
          .single();

        if (error) throw error;
        setSponsor(data);
        return data;
      } else {
        const { data, error } = await supabase
          .from('sponsors')
          .insert([{ ...sponsorData, is_active: true }])
          .select('*, member:members(id, name, avatar_url)')
          .single();

        if (error) throw error;
        setSponsor(data);
        return data;
      }
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to save sponsor');
    }
  };

  const uploadLogo = async (file: File): Promise<string> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      // Delete old logo if exists
      if (sponsor?.logo_url) {
        const oldPath = sponsor.logo_url.split('/sponsors/')[1];
        if (oldPath) {
          await supabase.storage.from('sponsors').remove([oldPath]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from('sponsors')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('sponsors')
        .getPublicUrl(filePath);

      // Update sponsor record with new logo URL
      if (sponsor) {
        const { data, error } = await supabase
          .from('sponsors')
          .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
          .eq('id', sponsor.id)
          .select('*, member:members(id, name, avatar_url)')
          .single();

        if (error) throw error;
        setSponsor(data);
      }

      return publicUrl;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to upload logo');
    }
  };

  const removeLogo = async () => {
    try {
      if (!sponsor?.logo_url) return;

      const oldPath = sponsor.logo_url.split('/sponsors/')[1];
      if (oldPath) {
        await supabase.storage.from('sponsors').remove([oldPath]);
      }

      const { data, error } = await supabase
        .from('sponsors')
        .update({ logo_url: null, updated_at: new Date().toISOString() })
        .eq('id', sponsor.id)
        .select('*, member:members(id, name, avatar_url)')
        .single();

      if (error) throw error;
      setSponsor(data);
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to remove logo');
    }
  };

  const removeSponsor = async () => {
    try {
      if (!sponsor) return;

      // Remove logo from storage
      if (sponsor.logo_url) {
        const oldPath = sponsor.logo_url.split('/sponsors/')[1];
        if (oldPath) {
          await supabase.storage.from('sponsors').remove([oldPath]);
        }
      }

      const { error } = await supabase
        .from('sponsors')
        .delete()
        .eq('id', sponsor.id);

      if (error) throw error;
      setSponsor(null);
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to remove sponsor');
    }
  };

  return {
    sponsor,
    loading,
    error,
    fetchSponsor,
    saveSponsor,
    uploadLogo,
    removeLogo,
    removeSponsor,
  };
}
