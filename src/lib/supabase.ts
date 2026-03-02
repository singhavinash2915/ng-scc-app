import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zrrmpaatydhlkntfpcmw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpycm1wYWF0eWRobGtudGZwY213Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyMTIzNDcsImV4cCI6MjA4Mjc4ODM0N30.kHot4i6MNPjt2neNzJ_tMAplJi_9CiYNgFzAzmEgdeg';

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
