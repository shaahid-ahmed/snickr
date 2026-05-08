'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface Props {
  inviteId:      string
  workspaceId:   string
  workspaceName: string
  workspaceSlug: string
  userId:        string
}

export default function JoinWorkspaceClient({
  inviteId,
  workspaceId,
  workspaceName,
  workspaceSlug,
  userId,
}: Props) {
  const supabase = createClient()
  const router   = useRouter()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function handleJoin() {
    setLoading(true)
    setError(null)

    // Add member
    const { error: memberErr } = await supabase.from('workspace_members').insert({
      workspace_id: workspaceId,
      user_id:      userId,
      role:         'member',
    })

    if (memberErr) {
      setError(memberErr.message)
      setLoading(false)
      return
    }

    // Increment use_count (non-critical, best-effort)
    try {
      await supabase.rpc('increment', { table: 'workspace_invites', id: inviteId, col: 'use_count' })
    } catch {
      // ignore
    }

    router.push(`/${workspaceSlug}`)
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">

        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand mb-4">
          <span className="text-white font-bold text-2xl">S</span>
        </div>

        <h1 className="text-2xl font-semibold text-ink mb-1">You're invited!</h1>
        <p className="text-ink-3 text-sm mb-6">
          Join <strong className="text-ink">{workspaceName}</strong> on Snikr
        </p>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100
                        rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}

        <button
          onClick={() => void handleJoin()}
          disabled={loading}
          className="btn-primary w-full py-3 text-base disabled:opacity-60"
        >
          {loading ? 'Joining…' : `Join ${workspaceName}`}
        </button>
      </div>
    </div>
  )
}
