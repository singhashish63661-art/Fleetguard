import type { SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

export type DashboardKind = 'admin' | 'client'

/** Matches login routing in app/page.tsx */
export function pathForProfileRole(role: string | null | undefined): '/admin' | '/client' {
  if (role === 'admin') return '/admin'
  return '/client'
}

export function roleAllowedOnDashboard(role: string | null | undefined, dashboard: DashboardKind): boolean {
  if (dashboard === 'admin') return role === 'admin'
  return role !== 'admin'
}

export type DashboardAuthOk = { ok: true; user: User; profile: Record<string, unknown> }
export type DashboardAuthFail = { ok: false }
export type DashboardAuthResult = DashboardAuthOk | DashboardAuthFail

/**
 * Validates Supabase session with the Auth server (getUser), loads profile, enforces role for this route.
 * On failure, calls replace('/') or the correct dashboard for the user's role.
 */
export async function ensureDashboardAuth(
  supabase: SupabaseClient,
  replace: (href: string) => void,
  dashboard: DashboardKind
): Promise<DashboardAuthResult> {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    replace('/')
    return { ok: false }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    replace('/')
    return { ok: false }
  }

  const role = profile.role as string | null | undefined
  if (!roleAllowedOnDashboard(role, dashboard)) {
    replace(pathForProfileRole(role))
    return { ok: false }
  }

  return { ok: true, user, profile: profile as Record<string, unknown> }
}
