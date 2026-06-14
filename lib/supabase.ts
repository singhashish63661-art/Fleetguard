import { createClient } from '@supabase/supabase-js'

function trimEnv(value: string | undefined): string | undefined {
  const v = value?.trim()
  return v || undefined
}

/** Decode JWT payload segment (base64url) without verifying signature. */
function decodeJwtPayloadJson(segment: string): { iss?: string; ref?: string } | null {
  try {
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    return JSON.parse(atob(padded)) as { iss?: string; ref?: string }
  } catch {
    return null
  }
}

/**
 * Normalize URL env: accept https://….supabase.co, or a mistaken legacy anon JWT
 * (derive https://<ref>.supabase.co from the `ref` claim).
 */
function resolveSupabaseUrlFromEnv(raw: string | undefined): string | undefined {
  const t = trimEnv(raw)
  if (!t) return undefined
  if (/^https?:\/\//i.test(t)) return t
  const parts = t.split('.')
  if (parts.length !== 3 || !t.startsWith('eyJ')) return undefined
  const payload = decodeJwtPayloadJson(parts[1] ?? '')
  if (payload?.iss === 'supabase' && typeof payload.ref === 'string' && payload.ref.length > 0) {
    return `https://${payload.ref}.supabase.co`
  }
  return undefined
}

const rawNextUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const rawSupabaseUrl = process.env.SUPABASE_URL
const resolvedUrl = resolveSupabaseUrlFromEnv(rawNextUrl) ?? resolveSupabaseUrlFromEnv(rawSupabaseUrl)
const hadUrlInput = Boolean(trimEnv(rawNextUrl) || trimEnv(rawSupabaseUrl))
const mistypedJwtAsUrl =
  hadUrlInput &&
  !resolvedUrl &&
  Boolean(trimEnv(rawNextUrl)?.startsWith('eyJ') || trimEnv(rawSupabaseUrl)?.startsWith('eyJ'))

const supabaseUrl = resolvedUrl || 'http://localhost:54321'

const supabaseKey =
  trimEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
  trimEnv(process.env.SUPABASE_ANON_KEY) ||
  'dev-anon-key'

if (typeof window !== 'undefined') {
  if (supabaseKey.startsWith('sb_secret_')) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY must be the publishable (sb_publishable_…) or anon (eyJ…) key — never the secret / service_role key in the browser.'
    )
  }
  if (mistypedJwtAsUrl) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL looks like a JWT. Put that value in NEXT_PUBLIC_SUPABASE_ANON_KEY instead, and set NEXT_PUBLIC_SUPABASE_URL to your Project URL (https://….supabase.co).'
    )
  }
  if (!resolvedUrl && supabaseKey.startsWith('sb_publishable_')) {
    throw new Error(
      'Set NEXT_PUBLIC_SUPABASE_URL to your https://….supabase.co project URL (Dashboard → Settings → API → Project URL), then restart the dev server.'
    )
  }
}

export const supabase = createClient(supabaseUrl, supabaseKey)
