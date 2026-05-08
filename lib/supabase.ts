import { createBrowserClient } from '@supabase/ssr'

// ─── Browser client — singleton ────────────────────────────────────────────
// createBrowserClient internally allocates a GoTrueClient, a RealtimeClient,
// and a BroadcastChannel for cross-tab auth sync. Calling it more than once
// orphans the previous instances (WebSockets, polling intervals, listeners)
// because they are never explicitly closed. A module-level singleton ensures
// the entire app shares one instance regardless of how many components call
// createClient().
const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: ReturnType<typeof createBrowserClient<any>> | null = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createClient(): ReturnType<typeof createBrowserClient<any>> {
  if (!_client) {
    _client = createBrowserClient<any>(
      SUPABASE_URL?.startsWith('http') ? SUPABASE_URL : 'https://placeholder.supabase.co',
      SUPABASE_ANON_KEY || 'placeholder-anon-key'
    )
  }
  return _client
}