import { createClient } from '@supabase/supabase-js';

export const supabaseUrl     = 'https://nptvrfqonfmafvbzjrih.supabase.co';
export const supabaseAnonKey = 'sb_publishable_NC3gqU5FnEFEhSO9KWPKNg_WpLnfo9G';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin password is validated server-side via Supabase RPC function
// No password stored in client-side code
export async function verifyAdminPassword(password: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('verify_admin_password', {
      input_password: password,
    });

    if (error) {
      console.error('Auth verification error:', error.message);
      return false;
    }

    return data === true;
  } catch {
    console.error('Auth verification failed');
    return false;
  }
}
