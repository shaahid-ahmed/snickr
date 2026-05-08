'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { slugify } from '@/lib/utils'
import { createWorkspace } from './actions'

export default function CreateWorkspacePage() {
  const router = useRouter()

  const [name,    setName]    = useState('')
  const [slug,    setSlug]    = useState('')
  const [error,   setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function handleNameChange(value: string) {
    setName(value)
    setSlug(slugify(value))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await createWorkspace(name, slug)

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    if (result.redirectTo) {
      router.push(result.redirectTo)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand mb-4">
            <span className="text-white font-bold text-xl">S</span>
          </div>
          <h1 className="text-2xl font-semibold text-ink">Create your workspace</h1>
          <p className="text-sm text-ink-3 mt-1">Give your team a home</p>
        </div>

        <div className="bg-white rounded-xl border border-surface-3 p-6 shadow-sm">
          <form onSubmit={e => void handleSubmit(e)} className="flex flex-col gap-5">

            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1.5">
                Workspace name
              </label>
              <input
                type="text"
                required
                autoFocus
                value={name}
                onChange={e => handleNameChange(e.target.value)}
                placeholder="Acme Corp"
                className="snikr-input"
                minLength={2}
                maxLength={60}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1.5">
                Workspace URL
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4 text-sm">
                  snikr.app/
                </span>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="acme-corp"
                  className="snikr-input pl-24"
                  minLength={2}
                  maxLength={50}
                />
              </div>
              <p className="text-xs text-ink-4 mt-1">
                Letters, numbers, and hyphens only.
              </p>
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100
                            rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !name || !slug}
              className="btn-primary py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating…' : 'Create workspace'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
