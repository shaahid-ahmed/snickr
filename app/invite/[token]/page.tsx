'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/components/providers/AuthProvider'
import { Loader2, ArrowRight, CheckCircle2, XCircle, Hash, MessageSquare, Zap } from 'lucide-react'
import type { Workspace, WorkspaceInvite } from '@/types'

type AuthTab = 'signin' | 'signup'
type PageState = 'loading' | 'error' | 'ready' | 'joining' | 'joined'

export default function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const router    = useRouter()
  const { user, loading: authLoading } = useAuth()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const supabase  = useMemo(() => createClient(), [])

  const [pageState,  setPageState]  = useState<PageState>('loading')
  const [invite,     setInvite]     = useState<(WorkspaceInvite & { workspace: Workspace }) | null>(null)
  const [errorMsg,   setErrorMsg]   = useState('')
  const [tab,        setTab]        = useState<AuthTab>('signin')

  // Auth form fields
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [fullName,  setFullName]  = useState('')
  const [username,  setUsername]  = useState('')
  const [authError, setAuthError] = useState('')
  const [authBusy,  setAuthBusy]  = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  // ── 1. Fetch invite ────────────────────────────────────────────────────────
  const fetchInvite = useCallback(async () => {
    const { data, error } = await supabase
      .from('workspace_invites')
      .select('*, workspace:workspaces(*)')
      .eq('id', token)
      .single()

    if (error || !data?.workspace) {
      setErrorMsg('This invite link is invalid or the workspace no longer exists.')
      setPageState('error')
      return
    }
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      setErrorMsg('This invite link has expired.')
      setPageState('error')
      return
    }
    if (data.max_uses !== null && data.use_count >= data.max_uses) {
      setErrorMsg('This invite link has reached its maximum number of uses.')
      setPageState('error')
      return
    }
    setInvite(data as any)
    setPageState('ready')
  }, [supabase, token])

  useEffect(() => { void fetchInvite() }, [fetchInvite])

  // ── 2. Auto-join once we have both invite + authenticated user ─────────────
  const join = useCallback(async (uid: string) => {
    if (!invite) return
    setPageState('joining')

    // Check already a member
    const { data: existing } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('workspace_id', invite.workspace_id)
      .eq('user_id', uid)
      .maybeSingle()

    if (existing) {
      router.push(`/${invite.workspace.slug}`)
      return
    }

    const { error } = await supabase.from('workspace_members').insert({
      workspace_id: invite.workspace_id,
      user_id:      uid,
      role:         'member',
    })

    if (error) {
      setErrorMsg(error.message)
      setPageState('error')
      return
    }

    // Best-effort use_count bump
    try {
      await supabase
        .from('workspace_invites')
        .update({ use_count: (invite.use_count ?? 0) + 1 })
        .eq('id', token)
    } catch { /* ignore */ }

    setPageState('joined')
    setTimeout(() => router.push(`/${invite.workspace.slug}`), 1200)
  }, [invite, supabase, token, router])

  // When auth state resolves and page is ready, auto-join
  useEffect(() => {
    if (!authLoading && user && pageState === 'ready') {
      void join(user.id)
    }
  }, [authLoading, user, pageState, join])

  // ── 3. Auth handlers ───────────────────────────────────────────────────────
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setAuthError('')
    setAuthBusy(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setAuthError(error.message)
      setAuthBusy(false)
    }
    // On success, AuthProvider fires SIGNED_IN → user state updates → useEffect above joins
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setAuthError('')
    setAuthBusy(true)

    const { data: taken } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username.toLowerCase().trim())
      .maybeSingle()

    if (taken) {
      setAuthError('That username is already taken.')
      setAuthBusy(false)
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Bring them back to this exact invite URL after email confirm
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(`/invite/${token}`)}`,
        data: { full_name: fullName.trim(), username: username.toLowerCase().trim() },
      },
    })

    if (error) {
      setAuthError(error.message)
      setAuthBusy(false)
      return
    }

    // If email confirmation is disabled, user is immediately logged in
    if (data.session) {
      // useEffect will pick up the user and auto-join
      setAuthBusy(false)
    } else {
      // Email confirmation required — show waiting screen
      setEmailSent(true)
      setAuthBusy(false)
    }
  }

  // ── Render states ──────────────────────────────────────────────────────────

  if (pageState === 'loading' || authLoading) {
    return (
      <Screen>
        <Loader2 className="w-8 h-8 text-brand animate-spin" />
        <p className="mt-3 text-sm text-ink-3">Loading invite…</p>
      </Screen>
    )
  }

  if (pageState === 'error') {
    return (
      <Screen>
        <div className="bg-white rounded-2xl border border-surface-3 shadow-lg p-8 w-full max-w-sm text-center">
          <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <h1 className="font-semibold text-ink mb-1">Invite unavailable</h1>
          <p className="text-sm text-ink-3 mb-6">{errorMsg}</p>
          <Link href="/" className="btn-primary w-full block text-center py-2.5">
            Go to Snikr
          </Link>
        </div>
      </Screen>
    )
  }

  if (pageState === 'joining') {
    return (
      <Screen>
        <Loader2 className="w-8 h-8 text-brand animate-spin" />
        <p className="mt-3 text-sm text-ink-3">
          Joining <strong className="text-ink">{invite?.workspace.name}</strong>…
        </p>
      </Screen>
    )
  }

  if (pageState === 'joined') {
    return (
      <Screen>
        <CheckCircle2 className="w-10 h-10 text-brand" />
        <p className="mt-3 font-semibold text-ink">You're in!</p>
        <p className="text-sm text-ink-3 mt-1">Redirecting to the workspace…</p>
      </Screen>
    )
  }

  const workspace = invite!.workspace

  return (
    <div className="min-h-screen bg-surface flex flex-col">

      {/* Top nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <span className="font-semibold text-ink text-[15px]">Snikr</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/login" className="text-ink-3 hover:text-ink transition-colors">Sign in</Link>
          <Link href="/signup" className="btn-primary px-4 py-1.5 text-sm">Sign up</Link>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">

          {/* Left: invite card + features */}
          <div className="flex flex-col gap-8">
            {/* Workspace invite card */}
            <div className="bg-white rounded-2xl border border-surface-3 shadow-sm p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-xl bg-brand-faint flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl font-bold text-brand">
                    {workspace.name[0].toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-ink-4 mb-0.5">
                    You're invited to join
                  </p>
                  <h1 className="text-xl font-bold text-ink">{workspace.name}</h1>
                </div>
              </div>
              <p className="text-sm text-ink-3">
                Sign in or create an account to accept this invite and start collaborating.
              </p>
            </div>

            {/* Why Snikr */}
            <div className="flex flex-col gap-3">
              <Feature icon={Hash} title="Organised channels" desc="Topic-based channels keep conversations focused and easy to find." />
              <Feature icon={MessageSquare} title="Direct messages" desc="Private 1:1 or group DMs for quick, focused conversations." />
              <Feature icon={Zap} title="Real-time" desc="Messages appear instantly — no refresh, no delays." />
            </div>
          </div>

          {/* Right: auth form */}
          <div className="bg-white rounded-2xl border border-surface-3 shadow-lg p-8">

            {emailSent ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-faint flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">📬</span>
                </div>
                <h2 className="font-semibold text-ink mb-2">Check your inbox</h2>
                <p className="text-sm text-ink-3">
                  We sent a confirmation link to <strong className="text-ink">{email}</strong>.
                  Once you confirm, you'll be brought straight back here to join{' '}
                  <strong className="text-ink">{workspace.name}</strong>.
                </p>
                <button
                  onClick={() => setEmailSent(false)}
                  className="mt-6 text-sm text-brand-dark hover:underline"
                >
                  Back
                </button>
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div className="flex rounded-lg bg-surface p-1 mb-6">
                  {(['signin', 'signup'] as AuthTab[]).map(t => (
                    <button
                      key={t}
                      onClick={() => { setTab(t); setAuthError('') }}
                      className={[
                        'flex-1 py-2 text-sm font-medium rounded-md transition-all',
                        tab === t
                          ? 'bg-white text-ink shadow-sm'
                          : 'text-ink-3 hover:text-ink',
                      ].join(' ')}
                    >
                      {t === 'signin' ? 'Sign in' : 'Create account'}
                    </button>
                  ))}
                </div>

                {tab === 'signin' ? (
                  <form onSubmit={e => void handleSignIn(e)} className="flex flex-col gap-4">
                    <Field label="Email">
                      <input type="email" required value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="you@example.com" className="snikr-input" autoComplete="email" />
                    </Field>
                    <Field label="Password">
                      <input type="password" required value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••" className="snikr-input" autoComplete="current-password" />
                    </Field>
                    {authError && <AuthError msg={authError} />}
                    <button type="submit" disabled={authBusy}
                      className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 disabled:opacity-60">
                      {authBusy ? <Loader2 size={16} className="animate-spin" /> : <>Sign in & join <ArrowRight size={16} /></>}
                    </button>
                    <p className="text-center text-xs text-ink-4">
                      No account yet?{' '}
                      <button type="button" onClick={() => setTab('signup')} className="text-brand-dark hover:underline">
                        Create one
                      </button>
                    </p>
                  </form>
                ) : (
                  <form onSubmit={e => void handleSignUp(e)} className="flex flex-col gap-4">
                    <Field label="Full name">
                      <input type="text" required value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        placeholder="Ada Lovelace" className="snikr-input" />
                    </Field>
                    <Field label="Username">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4 text-sm">@</span>
                        <input type="text" required value={username}
                          onChange={e => setUsername(e.target.value.replace(/[^a-z0-9_]/gi, '').toLowerCase())}
                          placeholder="ada" className="snikr-input pl-7"
                          minLength={2} maxLength={30} />
                      </div>
                    </Field>
                    <Field label="Email">
                      <input type="email" required value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="ada@example.com" className="snikr-input" autoComplete="email" />
                    </Field>
                    <Field label="Password">
                      <input type="password" required value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Min. 8 characters" className="snikr-input"
                        minLength={8} autoComplete="new-password" />
                    </Field>
                    {authError && <AuthError msg={authError} />}
                    <button type="submit" disabled={authBusy}
                      className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 disabled:opacity-60">
                      {authBusy ? <Loader2 size={16} className="animate-spin" /> : <>Create account & join <ArrowRight size={16} /></>}
                    </button>
                    <p className="text-center text-xs text-ink-4">
                      Already have an account?{' '}
                      <button type="button" onClick={() => setTab('signin')} className="text-brand-dark hover:underline">
                        Sign in
                      </button>
                    </p>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-ink-4">
        © {new Date().getFullYear()} Snikr · Team messaging, minus the noise.
      </footer>
    </div>
  )
}

// ── Small shared components ────────────────────────────────────────────────

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-2">
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-ink-2 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function AuthError({ msg }: { msg: string }) {
  return (
    <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
      {msg}
    </p>
  )
}

function Feature({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-brand-faint flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={15} className="text-brand" />
      </div>
      <div>
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="text-xs text-ink-3 mt-0.5">{desc}</p>
      </div>
    </div>
  )
}
