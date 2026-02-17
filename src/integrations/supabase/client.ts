// Supabase Client Configuration
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseMisconfigured = !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY;

if (supabaseMisconfigured) {
  console.error(
    '❌ Missing Supabase environment variables!\n' +
    'Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your environment.\n' +
    'For Vercel: Settings > Environment Variables\n' +
    'For local development: Create a .env file (see .env.example)'
  );
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase: SupabaseClient<Database> = supabaseMisconfigured
  ? new Proxy({} as SupabaseClient<Database>, {
      get(_target, prop) {
        if (prop === 'auth') {
          return new Proxy({}, {
            get() {
              return () => { throw new Error('Supabase non configuré. Vérifiez VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY.'); };
            }
          });
        }
        throw new Error('Supabase non configuré. Vérifiez VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY.');
      }
    })
  : createClient<Database>(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          storage: typeof window !== 'undefined' ? localStorage : undefined,
          persistSession: true,
          autoRefreshToken: true,
        }
      }
    );