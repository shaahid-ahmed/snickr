'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const supabase = createClient()
  const router   = useRouter()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const returnTo = new URLSearchParams(window.location.search).get('returnTo')
    router.push(returnTo ?? '/')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand mb-4">
            <span className="text-white font-bold text-xl">S</span>
          </div>
          <h1 className="text-2xl font-semibold text-ink">Welcome back</h1>
          <p className="text-sm text-ink-3 mt-1">Sign in to your Snikr workspace</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl border border-surface-3 p-6 shadow-sm">
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1.5" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="snikr-input"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-ink-2" htmlFor="password">
                  Password
                </label>
                <Link href="/forgot-password" className="text-xs text-brand-dark hover:underline">
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="snikr-input"
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
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-ink-3 mt-5">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-brand-dark font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
