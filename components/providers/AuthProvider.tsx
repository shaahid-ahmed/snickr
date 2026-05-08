'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react'
import { useRouter } from 'next/navigation'
import type { User, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase'
import type { Profile } from '@/types'

// ─── Context shape ──────────────────────────────────────────────────────────
interface AuthContextValue {
  user:        User    | null
  profile:     Profile | null
  session:     Session | null
  loading:     boolean
  signOut:     () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ─── Provider ───────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  // createClient() is now a singleton — same object on every call, so it is
  // safe to call without useMemo and safe to include in effect deps without
  // triggering re-runs.
  const supabase = createClient()
  const router   = useRouter()

  const [user,    setUser]    = useState<User    | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // Stable — supabase is a singleton so this never changes reference.
  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (!error && data) setProfile(data)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id)
  }, [user, fetchProfile])

  // ── Bootstrap session on mount ──────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      setLoading(false)
    })

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)

        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
        }

        if (event === 'SIGNED_OUT') {
          router.push('/login')
          router.refresh()
        }
      }
    )

    return () => subscription.unsubscribe()
    // Empty deps — supabase is a singleton (never changes), fetchProfile is
    // stable (empty deps above), router identity is stable in Next.js App Router.
    // This effect must run exactly once: creating multiple onAuthStateChange
    // listeners causes GoTrue to spin up duplicate token-refresh polling loops.
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sign out ────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [supabase])

  return (
    <AuthContext.Provider
      value={{ user, profile, session, loading, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// ─── Hook ───────────────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}