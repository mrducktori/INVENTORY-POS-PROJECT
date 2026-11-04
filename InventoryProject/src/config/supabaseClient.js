import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || '';

// Fallback to placeholder if env vars are not yet configured, preventing crash at boot
export const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : createClient('https://placeholder-project.supabase.co', 'placeholder-anon-key');
