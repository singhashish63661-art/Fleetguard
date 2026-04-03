import { createClient } from '@supabase/supabase-js'

// Fallbacks prevent build-time crashes if env is missing in the build environment.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'http://localhost:54321'

const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'dev-anon-key'

export const supabase = createClient(supabaseUrl, supabaseKey)
