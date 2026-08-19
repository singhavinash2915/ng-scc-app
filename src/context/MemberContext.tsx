import type { ReactNode } from 'react';
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Member } from '../types';

// ─── Who is using the app ─────────────────────────────────────────────────────
// Until now the app rendered identically for all 46 members: a club database
// everyone browsed. The only trace of identity was a raw member id parked in
// localStorage by the scoring page, and a shared PIN gating two routes.
//
// Signing in changes what the app IS. "Your next match is Sunday, you're picked,
// your balance is ₹340" is a different product from "here are the club's
// fixtures", and every personal feature — notifications, goals, ratings, Wrapped
// — needs to know who's asking before it can exist.
//
// Sign-in is the phone number alone. No PIN, no password, no OTP.
//
// Worth being explicit about what that means: anyone who knows a member's
// number can sign in as them and see their balance, and in a club WhatsApp
// group everyone has everyone's number. The club chose this knowingly — a
// shared PIN was one more thing to forget and ask about, while stopping nobody
// who was already in the group.
//
// It is defensible here only because there is nothing to protect: RLS is open
// and the anon key ships in the bundle, so members, matches and balances were
// already readable by anyone with the URL. This is personalisation — the app
// knowing who you are so it can show you your own season — and it must not be
// mistaken for security. If member data ever needs protecting, the answer is
// RLS plus real auth together, not a secret on the sign-in form.

const STORAGE_KEY = 'scc-me';

interface MemberContextType {
  me: Member | null;
  /** Still reading localStorage / refetching on boot. */
  loading: boolean;
  signIn: (phone: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => void;
}

const MemberContext = createContext<MemberContextType | undefined>(undefined);

/** Last 10 digits, so +91 / 0 / spaces / dashes all compare equal. */
const digits = (s: string) => s.replace(/\D/g, '').slice(-10);

export function MemberProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  // Re-read the member on boot rather than trusting the cached copy: balance,
  // avatar and status all change, and a stale wallet figure is worse than none.
  useEffect(() => {
    const id = localStorage.getItem(STORAGE_KEY);
    if (!id) { setLoading(false); return; }
    void (async () => {
      const { data } = await supabase.from('members').select('*').eq('id', id).maybeSingle();
      if (data) setMe(data as Member);
      else localStorage.removeItem(STORAGE_KEY);   // deleted member — sign out
      setLoading(false);
    })();
  }, []);

  const signIn = useCallback(async (phone: string) => {
    const want = digits(phone);
    if (want.length < 10) return { ok: false, error: 'Enter your 10-digit number.' };

    const { data, error } = await supabase.from('members').select('*');
    if (error) return { ok: false, error: error.message };

    const found = (data as Member[]).find(m => digits(m.phone ?? '') === want);
    if (!found) {
      return { ok: false, error: "That number isn't on the members list. Ask an admin to add it." };
    }
    localStorage.setItem(STORAGE_KEY, found.id);
    // Keep the scoring page's existing key in step so a signed-in member is
    // recognised as the scorer without signing in twice.
    localStorage.setItem('scc-my-profile-id', found.id);
    setMe(found);
    return { ok: true };
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('scc-my-profile-id');
    setMe(null);
  }, []);

  return (
    <MemberContext.Provider value={{ me, loading, signIn, signOut }}>
      {children}
    </MemberContext.Provider>
  );
}

export function useMe() {
  const ctx = useContext(MemberContext);
  if (!ctx) throw new Error('useMe must be used within a MemberProvider');
  return ctx;
}
