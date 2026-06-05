import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface GroundDetails {
  name: string;
  address: string;
  directions_url: string;
  facilities: string;
  timing: string;
  notes: string;
  image_url: string;       // legacy single photo (kept for backward compat)
  image_urls: string[];    // multi-photo gallery
}

export interface BookingTestimonial {
  id: string;           // uuid generated client-side
  team: string;
  text: string;
  rating: number;       // 1–5
  active: boolean;
}

export interface UpiSettings {
  upi_id: string;
  upi_name: string;
  qr_code_url: string;   // public URL to QR image (Supabase storage)
}

const GROUND_KEY       = 'ground_details';
const TESTIMONIALS_KEY = 'booking_testimonials';
const UPI_KEY          = 'booking_upi';

const defaultUpi: UpiSettings = {
  upi_id: 'scc.cricket@upi',
  upi_name: 'Sangria Cricket Club',
  qr_code_url: '',
};

const defaultGround: GroundDetails = {
  name: 'SCC Ground',
  address: 'Mumbai, Maharashtra',
  directions_url: '',
  facilities: '',
  timing: '6:00 AM – 10:00 PM',
  notes: '',
  image_url: '',
  image_urls: [],
};

export function useGroundSettings() {
  const [ground, setGround]           = useState<GroundDetails>(defaultGround);
  const [testimonials, setTestimonials] = useState<BookingTestimonial[]>([]);
  const [upi, setUpi]                 = useState<UpiSettings>(defaultUpi);
  const [loading, setLoading]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);

  // ─── Fetch all settings ───────────────────────────────────────────────────
  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('app_configs')
        .select('key, value')
        .in('key', [GROUND_KEY, TESTIMONIALS_KEY, UPI_KEY]);

      if (err) throw err;

      for (const row of data || []) {
        if (row.key === GROUND_KEY) {
          const saved = row.value as Partial<GroundDetails>;
          // Backward compat: if image_urls is missing but image_url exists, seed it
          const image_urls: string[] =
            Array.isArray(saved.image_urls) && saved.image_urls.length > 0
              ? saved.image_urls
              : saved.image_url ? [saved.image_url] : [];
          setGround({ ...defaultGround, ...saved, image_urls });
        }
        if (row.key === TESTIMONIALS_KEY) {
          setTestimonials((row.value as BookingTestimonial[]) || []);
        }
        if (row.key === UPI_KEY) {
          setUpi({ ...defaultUpi, ...(row.value as Partial<UpiSettings>) });
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

  // ─── Upload ground image (unique filename so multiple photos can coexist) ──
  const uploadGroundImage = async (file: File): Promise<string | null> => {
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `ground/scc-ground-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('sponsors')          // reuse public sponsors bucket
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('sponsors').getPublicUrl(path);
      return publicUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image upload failed');
      return null;
    }
  };

  // ─── Remove one photo from the gallery and persist ───────────────────────
  const removeGroundImage = async (url: string): Promise<boolean> => {
    const updated: GroundDetails = {
      ...ground,
      image_urls: ground.image_urls.filter(u => u !== url),
      image_url: ground.image_url === url ? '' : ground.image_url,
    };
    return saveGround(updated);
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

  // ─── Save UPI settings ────────────────────────────────────────────────────
  const saveUpi = async (data: UpiSettings): Promise<boolean> => {
    setSaving(true);
    try {
      const { error: err } = await supabase
        .from('app_configs')
        .upsert({ key: UPI_KEY, value: data as unknown as Record<string, unknown> }, { onConflict: 'key' });
      if (err) throw err;
      setUpi(data);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save UPI settings');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // ─── Upload UPI QR code image (replaces previous) ─────────────────────────
  const uploadQrCode = async (file: File): Promise<string | null> => {
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `qr/scc-upi-qr-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('sponsors')        // reuse public sponsors bucket
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('sponsors').getPublicUrl(path);
      return publicUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'QR upload failed');
      return null;
    }
  };

  return {
    ground, testimonials, upi, loading, saving, error,
    fetchSettings,
    saveGround, uploadGroundImage, removeGroundImage,
    saveTestimonials, addTestimonial, updateTestimonial, deleteTestimonial,
    saveUpi, uploadQrCode,
  };
}
