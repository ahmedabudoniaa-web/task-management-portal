import { createClient } from '@supabase/supabase-js'

// Set these in your Netlify environment variables:
// VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
// (Find them in Supabase: Project Settings > API)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
