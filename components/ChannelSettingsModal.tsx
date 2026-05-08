'use client'

import { useEffect, useState, useCallback, useTransition } from 'react'
import { X, UserPlus, UserMinus, Shield, ShieldAlert, Search, Loader2, Paperclip, Settings2, Camera, Archive } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { Avatar } from '@/components/Avatar'
import { MediaPanel } from '@/components/MediaPanel'
import {
  addMemberToChannel,
  removeMemberFromChannel,
  updateMemberRole,
} from '@/app/(app)/[workspace]/channel/actions'
import type { Channel, ChannelMember, Profile, ChannelRole } from '@/types'

interface WorkspaceMemberRow {
  user_id: string
  role: string
  profile: Profile
}

interface ChannelSettingsModalProps {
  isOpen:        boolean
  onClose:       () => void
  channel:       Channel
  currentUserId: string
  isAdmin:       boolean
  defaultTab?:   'members' | 'add' | 'files' | 'settings'
  onMembersChange?: () => void   // callback so Sidebar can refresh via realtime
}

export function ChannelSettingsModal({
  isOpen,
  onClose,
  channel,
  currentUserId,
  isAdmin,
  defaultTab,
  onMembersChange,
}: ChannelSettingsModalProps) {
  
  const supabase = createClient()

  const [channelMembers,   setChannelMembers]   = useState<(ChannelMember & { profile: Profile })[]>([])
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMemberRow[]>([])
  const [loading,          setLoading]          = useState(true)
  const [search,           setSearch]           = useState('')
  const [tab,              setTab]              = useState<'members' | 'add' | 'files' | 'settings'>(defaultTab ?? 'members')
  // Sync tab when modal reopens with a different defaultTab (e.g. logo icon vs gear icon)
  useEffect(() => { if (isOpen) setTab(defaultTab ?? 'members') }, [isOpen, defaultTab])
  const [logoUploading,    setLogoUploading]    = useState(false)
  const [logoUrl,          setLogoUrl]          = useState<string | null>(channel.logo_url ?? null)
  const [archiveConfirm,   setArchiveConfirm]   = useState(false)
  const [archiving,        setArchiving]        = useState(false)
  const [actionError,      setActionError]      = useState<string | null>(null)
  const [isPending,        startTransition]     = useTransition()

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    const [chRes, wsRes] = await Promise.all([
      supabase
        .from('channel_members')
        .select('*, profile:profiles(*)')
        .eq('channel_id', channel.id),
      supabase
        .from('workspace_members')
        .select('user_id, role, profile:profiles(*)')
        .eq('workspace_id', channel.workspace_id),
    ])
    if (chRes.data) setChannelMembers(chRes.data as any)
    if (wsRes.data) setWorkspaceMembers(wsRes.data as any)
    setLoading(false)
  }, [supabase, channel.id, channel.workspace_id])

  useEffect(() => {
    if (isOpen) {
      setSearch('')
      setTab('members')
      setActionError(null)
      void fetchMembers()
    }
  }, [isOpen, fetchMembers])

  // If the files tab is open, render the MediaPanel drawer instead of the modal
  if (isOpen && tab === 'files') {
    return (
      <MediaPanel
        channelId={channel.id}
        title={`#${channel.name}`}
        onClose={onClose}
      />
    )
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    try {
      const ext  = file.name.split('.').pop() ?? 'jpg'
      const path = `channel-logos/${channel.id}-${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (uploadErr) { console.error(uploadErr); return }
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('channels').update({ logo_url: publicUrl } as any).eq('id', channel.id)
      setLogoUrl(publicUrl)
    } finally {
      setLogoUploading(false)
      if (e.target) e.target.value = ''
    }
  }

  async function handleArchive() {
    setArchiving(true)
    await supabase.from('channels').update({ is_archived: true } as any).eq('id', channel.id)
    setArchiving(false)
    onClose()
    window.location.href = '/'
  }

  if (!isOpen) return null

  const q = search.toLowerCase()
  const filteredChannelMembers = channelMembers.filter(m =>
    m.profile.username.toLowerCase().includes(q) ||
    (m.profile.full_name?.toLowerCase().includes(q) ?? false)
  )
  const memberIds = new Set(channelMembers.map(m => m.user_id))
  const addCandidates = workspaceMembers.filter(m =>
    !memberIds.has(m.user_id) &&
    (m.profile.username.toLowerCase().includes(q) ||
     (m.profile.full_name?.toLowerCase().includes(q) ?? false))
  )

  function runAction(fn: () => Promise<{ error?: string; success?: boolean }>) {
    setActionError(null)
    startTransition(async () => {
      const res = await fn()
      if (res.error) {
        setActionError(res.error)
      } else {
        await fetchMembers()
        onMembersChange?.()
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="font-bold text-ink text-lg">#{channel.name}</h2>
            <p className="text-xs text-ink-4">Manage members and permissions</p>
          </div>
          <button onClick={onClose}
            className="p-1.5 hover:bg-surface rounded-md text-ink-4 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 border-b overflow-x-auto">
          {(['members', 'add', 'files', ...(isAdmin ? ['settings' as const] : [])] as const).map(t => (
            <button key={t}
              onClick={() => { setTab(t); setSearch('') }}
              className={[
                'flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                tab === t
                  ? 'border-brand text-brand'
                  : 'border-transparent text-ink-3 hover:text-ink',
              ].join(' ')}
            >
              {t === 'members'  && `Members (${channelMembers.length})`}
              {t === 'add'      && 'Add Members'}
              {t === 'files'    && <><Paperclip size={13} />Files</>}
              {t === 'settings' && <><Settings2 size={13} />Settings</>}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" />
            <input
              autoFocus
              type="text"
              placeholder={tab === 'members' ? 'Search members…' : 'Search people to add…'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-surface border-0 rounded-lg pl-9 pr-4 py-2
                         text-sm text-ink placeholder:text-ink-4 outline-none
                         focus:ring-2 focus:ring-brand/20"
            />
          </div>
        </div>

        {/* Error banner */}
        {actionError && (
          <div className="mx-4 mt-3 px-3 py-2 bg-red-50 border border-red-100 rounded-lg
                          text-xs text-red-600 flex items-center justify-between">
            {actionError}
            <button onClick={() => setActionError(null)} className="ml-2 text-red-400 hover:text-red-600">
              <X size={13} />
            </button>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2">
          {tab === 'settings' ? (
            <div className="p-4 space-y-6">
              {/* Channel logo */}
              <div>
                <p className="text-xs font-semibold text-ink-3 uppercase tracking-wide mb-3">Channel Logo</p>
                <div className="flex items-center gap-4">
                  <div className="relative w-14 h-14 rounded-xl bg-brand flex items-center justify-center flex-shrink-0 overflow-hidden border border-surface-3">
                    {logoUrl
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={logoUrl} alt="Channel logo" className="w-full h-full object-cover" />
                      : <span className="text-white font-bold text-xl">#</span>
                    }
                    {logoUploading && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Loader2 size={18} className="text-white animate-spin" />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-lg
                                      bg-brand text-white text-xs font-medium hover:bg-brand-dark transition-colors">
                      <Camera size={13} />
                      {logoUrl ? 'Change logo' : 'Upload logo'}
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => void handleLogoUpload(e)} disabled={logoUploading} />
                    </label>
                    {logoUrl && (
                      <button
                        className="ml-2 text-xs text-ink-4 hover:text-red-500 transition-colors"
                        onClick={async () => {
                          await supabase.from('channels').update({ logo_url: null } as any).eq('id', channel.id)
                          setLogoUrl(null)
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Archive channel */}
              <div>
                <p className="text-xs font-semibold text-ink-3 uppercase tracking-wide mb-3">Danger Zone</p>
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <div className="flex items-start gap-3">
                    <Archive size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-800">Archive channel</p>
                      <p className="text-xs text-red-600 mt-0.5">
                        The channel will be hidden from the sidebar. Messages are preserved and the channel can be unarchived later.
                      </p>
                      {archiveConfirm ? (
                        <div className="flex items-center gap-2 mt-3">
                          <button
                            disabled={archiving}
                            onClick={() => void handleArchive()}
                            className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg
                                       hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-1.5">
                            {archiving ? <Loader2 size={12} className="animate-spin" /> : null}
                            Yes, archive
                          </button>
                          <button onClick={() => setArchiveConfirm(false)}
                            className="px-3 py-1.5 bg-white text-ink-3 text-xs font-medium rounded-lg
                                       border border-surface-3 hover:bg-surface transition-colors">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setArchiveConfirm(true)}
                          className="mt-3 px-3 py-1.5 bg-white text-red-600 border border-red-200 text-xs
                                     font-medium rounded-lg hover:bg-red-50 transition-colors">
                          Archive this channel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : loading ? (
            <div className="p-8 flex justify-center">
              <Loader2 size={20} className="animate-spin text-brand" />
            </div>
          ) : tab === 'members' ? (
            <div className="space-y-0.5">
              {filteredChannelMembers.length === 0 ? (
                <p className="p-8 text-center text-sm text-ink-4">No members found.</p>
              ) : filteredChannelMembers.map(member => (
                <div key={member.user_id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface group">
                  <Avatar src={member.profile.avatar_url} username={member.profile.username} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-ink truncate">
                        {member.profile.full_name ?? member.profile.username}
                      </p>
                      {member.role === 'admin' && (
                        <span className="text-[10px] font-bold uppercase tracking-wider
                                         bg-brand-faint text-brand-dark px-1.5 py-0.5 rounded">
                          Admin
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-4">@{member.profile.username}</p>
                  </div>

                  {/* Self label */}
                  {member.user_id === currentUserId && (
                    <span className="text-xs text-ink-4 italic px-2">You</span>
                  )}

                  {/* Admin actions on others */}
                  {isAdmin && member.user_id !== currentUserId && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        disabled={isPending}
                        onClick={() => runAction(() =>
                          updateMemberRole(channel.id, member.user_id,
                            member.role === 'admin' ? 'member' : 'admin')
                        )}
                        title={member.role === 'admin' ? 'Make member' : 'Make admin'}
                        className="p-1.5 hover:bg-white rounded-md text-ink-3 hover:text-brand
                                   transition-colors disabled:opacity-40"
                      >
                        {member.role === 'admin' ? <ShieldAlert size={15} /> : <Shield size={15} />}
                      </button>
                      <button
                        disabled={isPending}
                        onClick={() => runAction(() =>
                          removeMemberFromChannel(channel.id, member.user_id)
                        )}
                        title="Remove from channel"
                        className="p-1.5 hover:bg-white rounded-md text-ink-3 hover:text-red-500
                                   transition-colors disabled:opacity-40"
                      >
                        <UserMinus size={15} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* Add Members tab */
            <div className="space-y-0.5">
              {addCandidates.length === 0 ? (
                <p className="p-8 text-center text-sm text-ink-4">
                  {workspaceMembers.length === channelMembers.length
                    ? 'Everyone in the workspace is already here!'
                    : 'No matching people found.'}
                </p>
              ) : addCandidates.map(member => (
                <div key={member.user_id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface">
                  <Avatar src={member.profile.avatar_url} username={member.profile.username} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">
                      {member.profile.full_name ?? member.profile.username}
                    </p>
                    <p className="text-xs text-ink-4">@{member.profile.username}</p>
                  </div>
                  {isAdmin && (
                    <button
                      disabled={isPending}
                      onClick={() => runAction(() =>
                        addMemberToChannel(channel.id, member.user_id)
                      )}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white
                                 rounded-lg text-xs font-medium hover:bg-brand-dark
                                 transition-colors disabled:opacity-50"
                    >
                      {isPending ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
                      Add
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-surface-faint flex justify-end">
          <button onClick={onClose} className="btn-ghost">Done</button>
        </div>
      </div>
    </div>
  )
}
