import { createServerClient } from '@supabase/ssr'
import { createBrowserClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const safeUrl = SUPABASE_URL?.startsWith('http') ? SUPABASE_URL : 'https://placeholder.supabase.co'

// ─── Server client (use in Server Components and Route Handlers) ───────────
// Untyped: security is enforced by RLS; browser client (hooks) is fully typed.
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createServerClient<any>(
    safeUrl,
    SUPABASE_ANON_KEY || 'placeholder-anon-key',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Silently ignore when called from Server Component
          }
        },
      },
    }
  )
}

// ─── Service-role client (bypass RLS — only in trusted server code) ─────────
export function createServiceClient() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createBrowserClient<any>(
    safeUrl,
    SERVICE_ROLE_KEY || 'placeholder-service-key'
  )
}
