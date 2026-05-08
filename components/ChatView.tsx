'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Hash, Paperclip, Pin, Settings, Users, X } from 'lucide-react'
import { MessageList } from '@/components/MessageList'
import { MessageInput } from '@/components/MessageInput'
import { TypingIndicator } from '@/components/TypingIndicator'
import { Avatar } from '@/components/Avatar'
import { ChannelSettingsModal } from '@/components/ChannelSettingsModal'
import { UserProfileModal } from '@/components/UserProfileModal'
import { MediaPanel } from '@/components/MediaPanel'
import { useMessages } from '@/hooks/useMessages'
import { useTyping } from '@/hooks/useTyping'
import { useAuth } from '@/components/providers/AuthProvider'
import { formatTime } from '@/lib/utils'
import type { Channel, ChannelRole, Profile } from '@/types'

interface ChatViewProps {
  workspaceId:     string
  workspaceSlug?:  string
  channel?:        Channel
  conversationId?: string
  otherMembers?:   Profile[]
  currentUserId:   string
  userRole?:       ChannelRole
}

export function ChatView({
  workspaceId,
  channel,
  conversationId,
  otherMembers,
  currentUserId,
  userRole = 'member',
}: ChatViewProps) {
  const {
    messages,
    pinnedMessages,
    loading,
    hasMore,
    loadMore,
    sendMessage,
    sendPoll,
    editMessage,
    deleteMessage,
    pinMessage,
    toggleReaction,
    markOneTimeViewed,
  } = useMessages({
    workspaceId,
    channelId:      channel?.id,
    conversationId,
  })

  const { profile } = useAuth()
  const currentUsername = profile?.username ?? ''

  
  const supabase = createClient()
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set())
  const [mutedIds,   setMutedIds]   = useState<Set<string>>(new Set())
  const [profileUserId, setProfileUserId] = useState<string | null>(null)

  // Load existing blocks + mutes from DB on mount
  useEffect(() => {
    supabase.from('blocked_users').select('blocked_id').eq('blocker_id', currentUserId)
      .then(({ data }) => {
        if (data?.length) setBlockedIds(new Set(data.map((r: any) => r.blocked_id as string)))
      })
    supabase.from('muted_users').select('muted_id').eq('muter_id', currentUserId)
      .then(({ data }) => {
        if (data?.length) setMutedIds(new Set(data.map((r: any) => r.muted_id as string)))
      })
  }, [supabase, currentUserId])

  const blockUser = useCallback(async (userId: string) => {
    setBlockedIds(prev => new Set([...prev, userId]))
    const { error } = await supabase
      .from('blocked_users')
      .insert({ blocker_id: currentUserId, blocked_id: userId })
    if (error) console.error('Block failed:', error.message)
  }, [supabase, currentUserId])

  const unblockUser = useCallback(async (userId: string) => {
    setBlockedIds(prev => { const s = new Set(prev); s.delete(userId); return s })
    await supabase.from('blocked_users')
      .delete().eq('blocker_id', currentUserId).eq('blocked_id', userId)
  }, [supabase, currentUserId])

  const muteUser = useCallback(async (userId: string) => {
    setMutedIds(prev => new Set([...prev, userId]))
    await supabase.from('muted_users').insert({ muter_id: currentUserId, muted_id: userId })
  }, [supabase, currentUserId])

  const unmuteUser = useCallback(async (userId: string) => {
    setMutedIds(prev => { const s = new Set(prev); s.delete(userId); return s })
    await supabase.from('muted_users')
      .delete().eq('muter_id', currentUserId).eq('muted_id', userId)
  }, [supabase, currentUserId])

  const roomKey = channel?.id
    ? `channel:${channel.id}`
    : conversationId ? `dm:${conversationId}` : ''
  const { typingUsers, notifyTyping } = useTyping(roomKey, currentUserId, currentUsername)

  const [settingsOpen,    setSettingsOpen]    = useState(false)
  const [settingsTab,     setSettingsTab]     = useState<'members' | 'add' | 'files' | 'settings'>('members')
  const [pinnedPanelOpen, setPinnedPanelOpen] = useState(false)
  const [mediaOpen,       setMediaOpen]       = useState(false)

  const isChannel = !!channel
  const title = isChannel
    ? channel.name
    : (otherMembers?.length === 0
        ? 'Notes to self'
        : otherMembers?.map(o => o.full_name ?? o.username).join(', ') ?? 'Chat')

  const primary = otherMembers?.[0]
  const isAdmin = userRole === 'admin'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-6 py-3 border-b border-surface-3 bg-white flex items-center
                         justify-between flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {isChannel ? (
            /* Clicking the channel icon opens settings (admins get logo tab) */
            <button
              onClick={() => { setSettingsTab(isAdmin ? 'settings' : 'members'); setSettingsOpen(true) }}
              title={isAdmin ? 'Channel settings · click to set logo' : 'Channel members'}
              className="flex-shrink-0 rounded-lg overflow-hidden hover:ring-2 hover:ring-brand/40 transition-all"
            >
              {channel.logo_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={channel.logo_url} alt={channel.name}
                    className="w-7 h-7 object-cover" />
                : <div className="w-7 h-7 flex items-center justify-center">
                    <Hash size={18} className="text-ink-3" />
                  </div>
              }
            </button>
          ) : primary ? (
            <Avatar src={primary.avatar_url} username={primary.username}
              size="sm" showStatus status={primary.status} isDnd={primary.is_dnd} />
          ) : (
            <span className="text-xl">📝</span>
          )}
          <div className="min-w-0">
            <h1 className="font-semibold text-ink text-[15px] truncate">{title}</h1>
            {isChannel && channel.description && (
              <p className="text-xs text-ink-4 mt-0.5 leading-none truncate">{channel.description}</p>
            )}
            {!isChannel && primary && (
              <p className="text-xs text-ink-4 mt-0.5 leading-none">@{primary.username}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Media & Files button */}
          <button
            onClick={() => setMediaOpen(v => !v)}
            className={`p-2 rounded-md transition-colors ${
              mediaOpen
                ? 'bg-brand-faint text-brand-dark'
                : 'text-ink-3 hover:text-ink hover:bg-surface'
            }`}
            title="Media & Files"
          >
            <Paperclip size={17} />
          </button>

          {pinnedMessages.length > 0 && (
            <button
              onClick={() => setPinnedPanelOpen(v => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${pinnedPanelOpen
                  ? 'bg-brand-faint text-brand-dark'
                  : 'text-ink-4 hover:text-ink hover:bg-surface'
                }`}
              title="Pinned messages"
            >
              <Pin size={13} />
              <span>{pinnedMessages.length} pinned</span>
            </button>
          )}

          {isChannel && (
            <button
              onClick={() => { setSettingsTab('members'); setSettingsOpen(true) }}
              className="p-2 hover:bg-surface rounded-md text-ink-3 hover:text-ink transition-colors"
              title={isAdmin ? 'Channel settings' : 'Channel members'}
            >
              {isAdmin ? <Settings size={18} /> : <Users size={18} />}
            </button>
          )}
        </div>
      </header>

      {/* Pinned messages panel */}
      {pinnedPanelOpen && pinnedMessages.length > 0 && (
        <div className="border-b border-surface-3 bg-amber-50/60 max-h-48 overflow-y-auto flex-shrink-0">
          <div className="px-4 py-2 flex items-center justify-between border-b border-amber-100">
            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
              <Pin size={12} />
              <span>{pinnedMessages.length} Pinned Message{pinnedMessages.length !== 1 ? 's' : ''}</span>
            </div>
            <button
              onClick={() => setPinnedPanelOpen(false)}
              className="p-0.5 rounded text-amber-600 hover:text-amber-800 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          <ul className="divide-y divide-amber-100">
            {pinnedMessages.map(msg => {
              const sender = msg.sender
              const displayName = sender?.full_name ?? sender?.username ?? 'Unknown'
              return (
                <li key={msg.id} className="px-4 py-2 flex gap-3 items-start">
                  <Avatar
                    src={sender?.avatar_url ?? null}
                    username={sender?.username ?? '?'}
                    size="xs"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-xs font-medium text-ink">{displayName}</span>
                      <span className="text-[10px] text-ink-4">{formatTime(msg.created_at)}</span>
                    </div>
                    <p className="text-xs text-ink-2 leading-relaxed line-clamp-2">{msg.content}</p>
                  </div>
                  <button
                    onClick={() => void pinMessage(msg.id, false)}
                    className="flex-shrink-0 text-[10px] text-ink-4 hover:text-red-500 transition-colors px-1.5 py-0.5 rounded hover:bg-red-50"
                    title="Unpin"
                  >
                    Unpin
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <MessageList
        messages={messages}
        loading={loading}
        hasMore={hasMore}
        loadMore={loadMore}
        currentUserId={currentUserId}
        currentUsername={currentUsername}
        blockedIds={blockedIds}
        mutedIds={mutedIds}
        onEdit={editMessage}
        onDelete={deleteMessage}
        onPin={pinMessage}
        onReact={toggleReaction}
        onBlock={blockUser}
        onOneTimeView={markOneTimeViewed}
        onViewProfile={setProfileUserId}
      />

      <TypingIndicator typingUsers={typingUsers} />

      <MessageInput
        onSend={sendMessage}
        onPoll={sendPoll}
        placeholder={isChannel ? `Message #${channel.name}` : `Message ${title}`}
        workspaceId={workspaceId}
        onTyping={notifyTyping}
      />

      {isChannel && (
        <ChannelSettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          channel={channel}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          defaultTab={settingsTab}
        />
      )}

      {mediaOpen && (
        <MediaPanel
          channelId={channel?.id}
          conversationId={conversationId}
          title={isChannel ? `#${channel?.name}` : title}
          onClose={() => setMediaOpen(false)}
        />
      )}

      {/* User profile modal — opened by clicking any avatar or name */}
      <UserProfileModal
        userId={profileUserId}
        currentUserId={currentUserId}
        isOpen={!!profileUserId}
        onClose={() => setProfileUserId(null)}
        blockedIds={blockedIds}
        mutedIds={mutedIds}
        onBlock={blockUser}
        onUnblock={unblockUser}
        onMute={muteUser}
        onUnmute={unmuteUser}
      />
    </div>
  )
}
