// Client Supabase personnalisé pointant vers l'instance Magellan
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/types';

const MAGELLAN_URL = 'https://qpqsmryanrlrqczerlig.supabase.co';
const MAGELLAN_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwcXNtcnlhbnJscnFjemVybGlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNzU3NDQsImV4cCI6MjA3Nzk1MTc0NH0.8HIQXNp10V2P70uMs8ok0SS_GhytiRwWdWvvFJ0pzSA';

// Import the Magellan Supabase client like this:
// import { supabase } from "@/integrations/magellan/client";

export const supabase = createClient<Database>(MAGELLAN_URL, MAGELLAN_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
