'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function SignupPage() {
  const supabase = createClient()
  const router   = useRouter()

  const [fullName,  setFullName]  = useState('')
  const [username,  setUsername]  = useState('')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [error,     setError]     = useState<string | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // Check username isn't taken
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username.toLowerCase().trim())
      .maybeSingle()

    if (existing) {
      setError('That username is already taken.')
      setLoading(false)
      return
    }

    const returnTo = new URLSearchParams(window.location.search).get('returnTo')
    const redirectTo = returnTo
      ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnTo)}`
      : `${window.location.origin}/auth/callback`

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          full_name: fullName.trim(),
          username:  username.toLowerCase().trim(),
        },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSubmitted(true)
  }

  // ── Email sent screen ────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-12 h-12
                          rounded-2xl bg-brand-faint border border-brand-light mb-4">
            <span className="text-2xl">📬</span>
          </div>
          <h2 className="text-xl font-semibold text-ink mb-2">Check your inbox</h2>
          <p className="text-sm text-ink-3">
            We sent a confirmation link to <strong className="text-ink">{email}</strong>.
            Click it to activate your account.
          </p>
          <Link href="/login" className="inline-block mt-6 text-sm text-brand-dark hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand mb-4">
            <span className="text-white font-bold text-xl">S</span>
          </div>
          <h1 className="text-2xl font-semibold text-ink">Create your account</h1>
          <p className="text-sm text-ink-3 mt-1">Start messaging with your team</p>
        </div>

        <div className="bg-white rounded-xl border border-surface-3 p-6 shadow-sm">
          <form onSubmit={handleSignup} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1.5" htmlFor="full_name">
                Full name
              </label>
              <input
                id="full_name"
                type="text"
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Ada Lovelace"
                className="snikr-input"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1.5" htmlFor="username">
                Username
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4 text-sm">@</span>
                <input
                  id="username"
                  type="text"
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value.replace(/[^a-z0-9_]/gi, ''))}
                  placeholder="ada"
                  className="snikr-input pl-7"
                  minLength={2}
                  maxLength={30}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1.5" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ada@example.com"
                className="snikr-input"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1.5" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="snikr-input"
                minLength={8}
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-ink-3 mt-5">
          Already have an account?{' '}
          <Link href="/login" className="text-brand-dark font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
