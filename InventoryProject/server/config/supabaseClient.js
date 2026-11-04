import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try loading .env from InventoryProject root (local dev),
// then fall back to the server/ directory itself (cPanel production).
const envPaths = [
  path.resolve(__dirname, '../../.env'), // Local dev: InventoryProject/.env
  path.resolve(__dirname, '../.env'),    // cPanel: one level up from server/
  path.resolve(__dirname, '.env'),       // cPanel fallback: server/.env
];

for (const envPath of envPaths) {
  const result = dotenv.config({ path: envPath });
  if (!result.error) break; // Stop at first successful load
}

// Support both standard SUPABASE_URL and frontend VITE_SUPABASE_URL
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase URL or Key in environment variables. Please check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false // Recommended for backend servers
  },
  realtime: {
    transport: ws // Fixes the Node 20 WebSocket error on cPanel / cloud hosts
  }
});
