import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || '';

// Custom client options: Disable internal GoTrue Web Locks and auto-refresh since our app uses
// custom server-side JWT / session management. This prevents "Acquiring an exclusive Navigator
// LockManager lock failed" crashes in multi-tab or backgrounded browser sessions.
const clientOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    lock: async (_name, _acquireTimeout, fn) => fn(),
  }
};

// Fallback to placeholder if env vars are not yet configured, preventing crash at boot
export const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey, clientOptions)
  : createClient('https://placeholder-project.supabase.co', 'placeholder-anon-key', clientOptions);

