'use client'

import { useState } from 'react'
import { Search, X, Loader2 } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import type { Profile } from '@/types'

interface NewDmModalProps {
  isOpen:        boolean
  onClose:       () => void
  members:       Profile[]
  onSelect:      (userId: string) => Promise<void> | void
  currentUserId: string
  error?:        string | null
}

export function NewDmModal({
  isOpen,
  onClose,
  members,
  onSelect,
  currentUserId,
  error,
}: NewDmModalProps) {
  const [search,  setSearch]  = useState('')
  const [busyId,  setBusyId]  = useState<string | null>(null)

  if (!isOpen) return null

  const filtered = members.filter(m => {
    if (!m || m.id === currentUserId) return false
    const term = search.toLowerCase()
    return (
      m.username.toLowerCase().includes(term) ||
      (m.full_name?.toLowerCase().includes(term) ?? false)
    )
  })

  async function handleSelect(userId: string) {
    setBusyId(userId)
    await onSelect(userId)
    setBusyId(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">

        {/* Header */}
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="font-semibold text-ink">New Direct Message</h2>
          <button onClick={onClose}
            className="p-1 hover:bg-surface rounded-md text-ink-4 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" />
            <input
              autoFocus
              type="text"
              placeholder="Search members…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-surface border-0 rounded-lg pl-9 pr-4 py-2
                         text-sm text-ink placeholder:text-ink-4 outline-none
                         focus:ring-2 focus:ring-brand/20"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mt-3 px-3 py-2 bg-red-50 border border-red-100 rounded-lg
                          text-xs text-red-600">
            {error}
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-ink-4">
              {members.length <= 1 ? 'No other members in this workspace.' : 'No members found.'}
            </p>
          ) : (
            <div className="space-y-0.5">
              {filtered.map(member => (
                <button
                  key={member.id}
                  onClick={() => void handleSelect(member.id)}
                  disabled={busyId !== null}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg
                             hover:bg-brand-faint group transition-colors text-left
                             disabled:opacity-60"
                >
                  <Avatar
                    src={member.avatar_url}
                    username={member.username}
                    size="md"
                    showStatus
                    status={member.status}
                    isDnd={member.is_dnd}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink group-hover:text-brand-dark transition-colors">
                      {member.full_name ?? member.username}
                    </p>
                    <p className="text-xs text-ink-4">@{member.username}</p>
                  </div>
                  {busyId === member.id && (
                    <Loader2 size={16} className="animate-spin text-brand flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
