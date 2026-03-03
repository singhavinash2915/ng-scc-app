import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Sponsor } from '../types';

export function useSponsor() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Single active sponsor (first one) for backward compat
  const sponsor = sponsors.length > 0 ? sponsors[0] : null;

  const fetchSponsors = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sponsors')
        .select('*, member:members(id, name, avatar_url)')
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setSponsors(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sponsors');
    } finally {
      setLoading(false);
    }
  }, []);

  // Keep old name working
  const fetchSponsor = fetchSponsors;

  useEffect(() => {
    fetchSponsors();
  }, [fetchSponsors]);

  const saveSponsor = async (sponsorData: {
    id?: string;
    name: string;
    tagline?: string | null;
    description?: string | null;
    website_url?: string | null;
    member_id?: string | null;
  }) => {
    try {
      if (sponsorData.id) {
        // Update existing sponsor
        const { data, error } = await supabase
          .from('sponsors')
          .update({
            name: sponsorData.name,
            tagline: sponsorData.tagline,
            description: sponsorData.description,
            website_url: sponsorData.website_url,
            member_id: sponsorData.member_id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sponsorData.id)
          .select('*, member:members(id, name, avatar_url)')
          .single();

        if (error) throw error;
        setSponsors(prev => prev.map(s => s.id === data.id ? data : s));
        return data;
      } else {
        // Create new sponsor
        const { data, error } = await supabase
          .from('sponsors')
          .insert([{
            name: sponsorData.name,
            tagline: sponsorData.tagline,
            description: sponsorData.description,
            website_url: sponsorData.website_url,
            member_id: sponsorData.member_id,
            is_active: true,
          }])
          .select('*, member:members(id, name, avatar_url)')
          .single();

        if (error) throw error;
        setSponsors(prev => [...prev, data]);
        return data;
      }
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to save sponsor');
    }
  };

  const uploadLogo = async (file: File, sponsorId?: string): Promise<string> => {
    try {
      const targetId = sponsorId || sponsor?.id;
      const targetSponsor = sponsors.find(s => s.id === targetId);

      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      // Delete old logo if exists
      if (targetSponsor?.logo_url) {
        const oldPath = targetSponsor.logo_url.split('/sponsors/')[1];
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
      if (targetId) {
        const { data, error } = await supabase
          .from('sponsors')
          .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
          .eq('id', targetId)
          .select('*, member:members(id, name, avatar_url)')
          .single();

        if (error) throw error;
        setSponsors(prev => prev.map(s => s.id === data.id ? data : s));
      }

      return publicUrl;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to upload logo');
    }
  };

  const removeLogo = async (sponsorId?: string) => {
    try {
      const targetId = sponsorId || sponsor?.id;
      const targetSponsor = sponsors.find(s => s.id === targetId);
      if (!targetSponsor?.logo_url || !targetId) return;

      const oldPath = targetSponsor.logo_url.split('/sponsors/')[1];
      if (oldPath) {
        await supabase.storage.from('sponsors').remove([oldPath]);
      }

      const { data, error } = await supabase
        .from('sponsors')
        .update({ logo_url: null, updated_at: new Date().toISOString() })
        .eq('id', targetId)
        .select('*, member:members(id, name, avatar_url)')
        .single();

      if (error) throw error;
      setSponsors(prev => prev.map(s => s.id === data.id ? data : s));
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to remove logo');
    }
  };

  const removeSponsor = async (sponsorId?: string) => {
    try {
      const targetId = sponsorId || sponsor?.id;
      const targetSponsor = sponsors.find(s => s.id === targetId);
      if (!targetSponsor || !targetId) return;

      // Remove logo from storage
      if (targetSponsor.logo_url) {
        const oldPath = targetSponsor.logo_url.split('/sponsors/')[1];
        if (oldPath) {
          await supabase.storage.from('sponsors').remove([oldPath]);
        }
      }

      const { error } = await supabase
        .from('sponsors')
        .delete()
        .eq('id', targetId);

      if (error) throw error;
      setSponsors(prev => prev.filter(s => s.id !== targetId));
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to remove sponsor');
    }
  };

  return {
    sponsor,
    sponsors,
    loading,
    error,
    fetchSponsor,
    fetchSponsors,
    saveSponsor,
    uploadLogo,
    removeLogo,
    removeSponsor,
  };
}
