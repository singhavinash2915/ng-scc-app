import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface GroundDetails {
  name: string;
  address: string;
  directions_url: string;
  facilities: string;
  timing: string;
  notes: string;
  image_url: string;
}

export interface BookingTestimonial {
  id: string;           // uuid generated client-side
  team: string;
  text: string;
  rating: number;       // 1–5
  active: boolean;
}

const GROUND_KEY       = 'ground_details';
const TESTIMONIALS_KEY = 'booking_testimonials';

const defaultGround: GroundDetails = {
  name: 'SCC Ground',
  address: 'Mumbai, Maharashtra',
  directions_url: '',
  facilities: '',
  timing: '6:00 AM – 10:00 PM',
  notes: '',
  image_url: '',
};

export function useGroundSettings() {
  const [ground, setGround]           = useState<GroundDetails>(defaultGround);
  const [testimonials, setTestimonials] = useState<BookingTestimonial[]>([]);
  const [loading, setLoading]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);

  // ─── Fetch both settings ──────────────────────────────────────────────────
  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('app_configs')
        .select('key, value')
        .in('key', [GROUND_KEY, TESTIMONIALS_KEY]);

      if (err) throw err;

      for (const row of data || []) {
        if (row.key === GROUND_KEY) {
          setGround({ ...defaultGround, ...(row.value as Partial<GroundDetails>) });
        }
        if (row.key === TESTIMONIALS_KEY) {
          setTestimonials((row.value as BookingTestimonial[]) || []);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Save ground details ──────────────────────────────────────────────────
  const saveGround = async (data: GroundDetails): Promise<boolean> => {
    setSaving(true);
    try {
      const { error: err } = await supabase
        .from('app_configs')
        .upsert({ key: GROUND_KEY, value: data as unknown as Record<string, unknown> }, { onConflict: 'key' });
      if (err) throw err;
      setGround(data);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save ground details');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // ─── Upload ground image ──────────────────────────────────────────────────
  const uploadGroundImage = async (file: File): Promise<string | null> => {
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `ground/scc-ground.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('sponsors')          // reuse public sponsors bucket
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('sponsors').getPublicUrl(path);
      return publicUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image upload failed');
      return null;
    }
  };

  // ─── Save testimonials ────────────────────────────────────────────────────
  const saveTestimonials = async (list: BookingTestimonial[]): Promise<boolean> => {
    setSaving(true);
    try {
      const { error: err } = await supabase
        .from('app_configs')
        .upsert({ key: TESTIMONIALS_KEY, value: list as unknown as Record<string, unknown> }, { onConflict: 'key' });
      if (err) throw err;
      setTestimonials(list);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save testimonials');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // ─── Add / remove individual testimonials ────────────────────────────────
  const addTestimonial = async (t: Omit<BookingTestimonial, 'id'>) => {
    const updated = [...testimonials, { ...t, id: crypto.randomUUID() }];
    return saveTestimonials(updated);
  };

  const updateTestimonial = async (id: string, t: Partial<BookingTestimonial>) => {
    const updated = testimonials.map(x => x.id === id ? { ...x, ...t } : x);
    return saveTestimonials(updated);
  };

  const deleteTestimonial = async (id: string) => {
    const updated = testimonials.filter(x => x.id !== id);
    return saveTestimonials(updated);
  };

  return {
    ground, testimonials, loading, saving, error,
    fetchSettings,
    saveGround, uploadGroundImage,
    saveTestimonials, addTestimonial, updateTestimonial, deleteTestimonial,
  };
}
