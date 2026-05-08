'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, ShieldOff, BellOff, Check, Shield } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { Avatar } from '@/components/Avatar'
import type { Profile } from '@/types'

interface UserProfileModalProps {
  userId:        string | null
  currentUserId: string
  isOpen:        boolean
  onClose:       () => void
  blockedIds:    Set<string>
  mutedIds:      Set<string>
  onBlock:       (userId: string) => Promise<void>
  onUnblock:     (userId: string) => Promise<void>
  onMute:        (userId: string) => Promise<void>
  onUnmute:      (userId: string) => Promise<void>
}

export function UserProfileModal({
  userId,
  currentUserId,
  isOpen,
  onClose,
  blockedIds,
  mutedIds,
  onBlock,
  onUnblock,
  onMute,
  onUnmute,
}: UserProfileModalProps) {
  
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy,    setBusy]    = useState(false)

  useEffect(() => {
    if (!isOpen || !userId) { setProfile(null); return }
    setLoading(true)
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        setProfile(data as Profile | null)
        setLoading(false)
      })
  }, [isOpen, userId, supabase])

  if (!isOpen || !userId) return null

  const isSelf    = userId === currentUserId
  const isBlocked = blockedIds.has(userId)
  const isMuted   = mutedIds.has(userId)

  async function handleBlock() {
    setBusy(true)
    if (isBlocked) await onUnblock(userId!)
    else { await onBlock(userId!); onClose() }
    setBusy(false)
  }

  async function handleMute() {
    setBusy(true)
    if (isMuted) await onUnmute(userId!)
    else await onMute(userId!)
    setBusy(false)
  }

  const statusEmoji: Record<string, string> = {
    online: '🟢', away: '🌙', busy: '🔴', offline: '⚫',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Gradient banner */}
        <div className="h-24 bg-gradient-to-br from-brand to-brand-dark relative flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-white/60 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Avatar — overlaps banner */}
        <div className="px-5 -mt-10">
          <div className="w-20 h-20 rounded-2xl border-4 border-white shadow-md overflow-hidden bg-white">
            {loading ? (
              <div className="w-full h-full animate-pulse bg-surface" />
            ) : (
              <Avatar
                src={profile?.avatar_url}
                username={profile?.username ?? '?'}
                size="lg"
              />
            )}
          </div>
        </div>

        {/* Info */}
        <div className="px-5 pt-3 pb-5">
          {loading ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-5 bg-surface rounded-lg w-32" />
              <div className="h-3.5 bg-surface rounded-lg w-24" />
            </div>
          ) : (
            <>
              <h2 className="text-base font-bold text-ink leading-tight">
                {profile?.full_name ?? profile?.username ?? 'Unknown'}
              </h2>
              <p className="text-xs text-ink-4 mt-0.5">@{profile?.username}</p>
              {profile?.status && (
                <p className="text-sm text-ink-2 mt-2 flex items-center gap-1.5">
                  <span>{statusEmoji[profile.status] ?? '⚫'}</span>
                  <span className="capitalize">{profile.status}</span>
                </p>
              )}
            </>
          )}

          {/* Actions — only for other users */}
          {!isSelf && !loading && (
            <div className="mt-4 space-y-2">
              {/* Mute */}
              <button
                onClick={handleMute}
                disabled={busy}
                className={`flex items-center gap-2.5 w-full px-4 py-2.5 rounded-xl text-sm
                            font-medium transition-colors border disabled:opacity-60 ${
                  isMuted
                    ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                    : 'bg-surface border-surface-3 text-ink-2 hover:border-amber-200 hover:text-amber-700'
                }`}
              >
                <BellOff size={15} />
                <span className="flex-1 text-left">
                  {isMuted ? 'Unmute notifications' : 'Mute notifications'}
                </span>
                {isMuted && <Check size={13} className="text-amber-600" />}
              </button>

              {/* Block / Unblock */}
              <button
                onClick={handleBlock}
                disabled={busy}
                className={`flex items-center gap-2.5 w-full px-4 py-2.5 rounded-xl text-sm
                            font-medium transition-colors border disabled:opacity-60 ${
                  isBlocked
                    ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                    : 'bg-surface border-surface-3 text-ink-2 hover:border-red-200 hover:text-red-600'
                }`}
              >
                {isBlocked ? <Shield size={15} /> : <ShieldOff size={15} />}
                <span className="flex-1 text-left">
                  {isBlocked ? 'Unblock user' : 'Block user'}
                </span>
                {isBlocked && <Check size={13} className="text-red-500" />}
              </button>
            </div>
          )}

          {isSelf && !loading && (
            <p className="mt-4 text-xs text-ink-4 text-center">This is you</p>
          )}
        </div>
      </div>
    </div>
  )
}
