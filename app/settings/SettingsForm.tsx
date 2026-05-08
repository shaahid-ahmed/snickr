'use client'

import { useRef, useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, AtSign, Bell, BellOff, Camera, Check, Loader2, MessageSquare } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { useAuth } from '@/components/providers/AuthProvider'
import { createClient } from '@/lib/supabase'
import { updateProfile } from './actions'
import type { Profile, UserStatus } from '@/types'

const STATUS_OPTIONS: { value: UserStatus; label: string; dot: string }[] = [
  { value: 'available', label: 'Available',  dot: 'bg-green-400' },
  { value: 'busy',      label: 'Busy',       dot: 'bg-yellow-400' },
  { value: 'away',      label: 'Away',       dot: 'bg-gray-400' },
]

function Toggle({ on, onToggle, disabled }: { on: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onToggle} disabled={disabled}
      className={`relative w-10 rounded-full transition-colors focus:outline-none disabled:opacity-50
        ${on ? 'bg-brand' : 'bg-gray-200'}`}
      style={{ height: '1.375rem' }}>
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform
        ${on ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  )
}

export function SettingsForm({ profile }: { profile: Profile }) {
  const router = useRouter()
  const { refreshProfile } = useAuth()
  const [isPending, startTransition] = useTransition()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const supabase = useMemo(() => createClient(), [])

  const [fullName,      setFullName]      = useState(profile.full_name ?? '')
  const [username,      setUsername]      = useState(profile.username)
  const [status,        setStatus]        = useState<UserStatus>(profile.status)
  const [isDnd,         setIsDnd]         = useState(profile.is_dnd)
  const [notifMentions, setNotifMentions] = useState(profile.notif_mentions ?? true)
  const [notifDms,      setNotifDms]      = useState(profile.notif_dms ?? true)
  const [error,         setError]         = useState<string | null>(null)
  const [saved,         setSaved]         = useState(false)
  const [avatarUrl,     setAvatarUrl]     = useState<string | null>(profile.avatar_url)
  const [avatarBusy,    setAvatarBusy]    = useState(false)
  const [avatarError,   setAvatarError]   = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setAvatarError('Please select an image file.'); return }
    if (file.size > 5 * 1024 * 1024)    { setAvatarError('Image must be under 5 MB.'); return }
    setAvatarError(null); setAvatarBusy(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setAvatarError('Not authenticated.'); return }
      const ext  = file.name.split('.').pop() ?? 'jpg'
      const path = `avatars/${user.id}-${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (uploadErr) { setAvatarError(uploadErr.message); return }
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      const { error: profileErr } = await supabase.from('profiles').update({ avatar_url: publicUrl } as any).eq('id', user.id)
      if (profileErr) { setAvatarError(profileErr.message); return }
      setAvatarUrl(publicUrl)
      await refreshProfile()
    } catch (err) {
      setAvatarError('Upload failed. Please try again.')
      console.error('Avatar upload error:', err)
    } finally {
      setAvatarBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(null); setSaved(false)
    startTransition(async () => {
      const result = await updateProfile({
        full_name: fullName, username, status, is_dnd: isDnd,
        notif_mentions: notifMentions, notif_dms: notifDms,
      })
      if (result.error) { setError(result.error) }
      else { setSaved(true); await refreshProfile(); router.refresh() }
    })
  }

  return (
    <div className="min-h-screen bg-surface">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.back()}
          className="p-1.5 rounded-md text-ink-4 hover:text-ink hover:bg-surface transition-colors">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-semibold text-ink text-lg">Profile Settings</h1>
      </div>

      <div className="max-w-lg mx-auto px-6 py-10">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <div className="cursor-pointer group"
                onClick={() => !avatarBusy && fileInputRef.current?.click()} title="Click to change avatar">
                <Avatar src={avatarUrl} username={profile.username} size="lg" showStatus status={status} isDnd={isDnd} />
                <div className={`absolute inset-0 flex items-center justify-center rounded-full transition-opacity
                  ${avatarBusy ? 'opacity-100 bg-black/40' : 'opacity-0 group-hover:opacity-100 bg-black/30'}`}>
                  {avatarBusy ? <Loader2 size={20} className="text-white animate-spin" /> : <Camera size={18} className="text-white" />}
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => void handleAvatarChange(e)} />
            </div>
            <div>
              <p className="text-sm font-medium text-ink">{fullName || profile.username}</p>
              <p className="text-xs text-ink-4">@{username}</p>
              <button type="button" onClick={() => !avatarBusy && fileInputRef.current?.click()}
                className="mt-1.5 text-xs text-brand-dark hover:underline disabled:opacity-50" disabled={avatarBusy}>
                {avatarBusy ? 'Uploading…' : 'Change photo'}
              </button>
              {avatarError && <p className="text-xs text-red-500 mt-1">{avatarError}</p>}
            </div>
          </div>

          {/* Full name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-ink" htmlFor="full_name">Display name</label>
            <input id="full_name" type="text" value={fullName} onChange={e => setFullName(e.target.value)}
              placeholder="Your full name"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-ink
                         placeholder:text-ink-4 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-ink" htmlFor="username">Username</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4 text-sm">@</span>
              <input id="username" type="text" value={username} onChange={e => setUsername(e.target.value)}
                placeholder="username"
                className="w-full rounded-lg border border-gray-200 bg-white pl-7 pr-3 py-2 text-sm text-ink
                           placeholder:text-ink-4 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-ink">Status</label>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map(opt => (
                <button key={opt.value} type="button" onClick={() => setStatus(opt.value)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors
                    ${status === opt.value
                      ? 'border-brand bg-brand-faint text-brand-dark font-medium'
                      : 'border-gray-200 bg-white text-ink-4 hover:border-brand/40 hover:text-ink'}`}>
                  <span className={`w-2 h-2 rounded-full ${opt.dot}`} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Notification Settings ────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Bell size={15} className="text-ink-3" />
              <span className="text-sm font-semibold text-ink">Notifications</span>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
              {/* DND */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <BellOff size={15} className={isDnd ? 'text-brand-dark' : 'text-ink-4'} />
                  <div>
                    <p className="text-sm font-medium text-ink">Do Not Disturb</p>
                    <p className="text-xs text-ink-4">Silence all notifications</p>
                  </div>
                </div>
                <Toggle on={isDnd} onToggle={() => setIsDnd(v => !v)} />
              </div>

              {/* Mentions */}
              <div className={`flex items-center justify-between px-4 py-3 transition-opacity ${isDnd ? 'opacity-40' : ''}`}>
                <div className="flex items-center gap-2.5">
                  <AtSign size={15} className="text-ink-4" />
                  <div>
                    <p className="text-sm font-medium text-ink">Mentions</p>
                    <p className="text-xs text-ink-4">Notify when someone @mentions you</p>
                  </div>
                </div>
                <Toggle on={notifMentions} onToggle={() => setNotifMentions(v => !v)} disabled={isDnd} />
              </div>

              {/* DMs */}
              <div className={`flex items-center justify-between px-4 py-3 transition-opacity ${isDnd ? 'opacity-40' : ''}`}>
                <div className="flex items-center gap-2.5">
                  <MessageSquare size={15} className="text-ink-4" />
                  <div>
                    <p className="text-sm font-medium text-ink">Direct Messages</p>
                    <p className="text-xs text-ink-4">Notify for new DMs</p>
                  </div>
                </div>
                <Toggle on={notifDms} onToggle={() => setNotifDms(v => !v)} disabled={isDnd} />
              </div>
            </div>

            {isDnd && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <BellOff size={11} /> Do Not Disturb is on — all notifications are silenced
              </p>
            )}
          </div>

          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">{error}</div>
          )}

          <button type="submit" disabled={isPending}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg
                       bg-brand text-white text-sm font-medium hover:bg-brand-dark transition-colors disabled:opacity-60">
            {isPending ? <Loader2 size={16} className="animate-spin" /> : saved ? <><Check size={16} /> Saved</> : 'Save changes'}
          </button>
        </form>
      </div>
    </div>
  )
}
