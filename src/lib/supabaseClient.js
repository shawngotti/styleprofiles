import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env vars. Copy .env.example to .env and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
  )
}

// Single shared browser client. RLS is the security boundary — the anon key is
// safe to ship to the browser; it can only do what RLS policies allow.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
