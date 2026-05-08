'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  Hash,
  MessageSquare,
  Pin,
  Plus,
  Search,
  Settings,
  Bell,
  LogOut,
  Star,
} from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { NewDmModal } from '@/components/NewDmModal'
import { WorkspaceSettingsModal } from '@/components/WorkspaceSettingsModal'
import { WorkspaceSwitcher } from '@/components/WorkspaceSwitcher'
import { SearchModal } from '@/components/SearchModal'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useRealtimeChannels } from '@/hooks/useRealtime'
import { useNotifications } from '@/hooks/useNotifications'
import { NotificationsPanel } from '@/components/NotificationsPanel'
import { useAuth } from '@/components/providers/AuthProvider'
import { createOrGetDm } from '@/app/(app)/[workspace]/dm/actions'
import { cn } from '@/lib/utils'
import type { Channel } from '@/types'

interface SidebarProps {
  workspaceSlug: string
  workspaceId:   string
  workspaceName: string
  userId:        string
}

export function Sidebar({
  workspaceSlug,
  workspaceId,
  workspaceName,
  userId,
}: SidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const { profile, signOut } = useAuth()

  const {
    workspace,
    channels,
    dms,
    members,
    loading,
    refresh,
    fetchUnreadCounts,
    createChannel,
    pinChannel,
    starChannel,
    starDm,
    fetchArchivedChannels,
    unarchiveChannel,
  } = useWorkspace(workspaceId, userId)

  const { notifications, unreadCount, markRead, markAllRead } = useNotifications(workspaceId, userId)
  const [notifOpen, setNotifOpen] = useState(false)

  const [dmError,         setDmError]         = useState<string | null>(null)
  const [newChannelOpen,  setNewChannelOpen]  = useState(false)
  const [newChannelName,  setNewChannelName]  = useState('')
  const [newChannelError, setNewChannelError] = useState<string | null>(null)
  const [newChannelBusy,  setNewChannelBusy]  = useState(false)
  const [channelsOpen,    setChannelsOpen]    = useState(true)
  const [dmsOpen,         setDmsOpen]         = useState(true)
  const [starredOpen,     setStarredOpen]     = useState(true)
  const [newDmOpen,       setNewDmOpen]       = useState(false)
  const [archivedOpen,    setArchivedOpen]    = useState(false)
  const [archivedChannels, setArchivedChannels] = useState<import('@/types').Channel[]>([])
  const [archivedLoading,  setArchivedLoading]  = useState(false)
  const [wsSettingsOpen,  setWsSettingsOpen]  = useState(false)
  const [switcherOpen,    setSwitcherOpen]    = useState(false)
  const [searchOpen,      setSearchOpen]      = useState(false)

  // Determine current user's role in the workspace
  const currentUserRole = members.find(m => m.user_id === userId)?.role ?? 'member'

  // Debounce realtime-triggered refreshes — multiple rapid events
  // (e.g. channel rename + membership update at the same time) collapse into one call
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const handleChannelChange = useCallback(() => {
    clearTimeout(refreshTimerRef.current)
    refreshTimerRef.current = setTimeout(() => void refresh(), 500)
  }, [refresh])
  useRealtimeChannels({ workspaceId, userId, onChannelChange: handleChannelChange })

  // Refresh unread counts on route change — debounced so rapid navigation
  // (prefetch, back/forward) doesn't fire a burst of parallel RPC calls
  const unreadTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => {
    clearTimeout(unreadTimerRef.current)
    unreadTimerRef.current = setTimeout(() => void fetchUnreadCounts(), 400)
    return () => clearTimeout(unreadTimerRef.current)
  }, [pathname, fetchUnreadCounts])

  // Open search with Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const isChannelActive = (ch: Channel) =>
    pathname === `/${workspaceSlug}/channel/${ch.id}`

  const isDmActive = (id: string) =>
    pathname === `/${workspaceSlug}/dm/${id}`

  function cancelNewChannel() {
    setNewChannelOpen(false)
    setNewChannelName('')
    setNewChannelError(null)
  }

  async function handleCreateChannel(e: React.FormEvent) {
    e.preventDefault()
    const name = newChannelName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    if (!name) return
    setNewChannelError(null)
    setNewChannelBusy(true)
    const ch = await createChannel(name)
    setNewChannelBusy(false)
    if (ch) {
      cancelNewChannel()
      router.push(`/${workspaceSlug}/channel/${ch.id}`)
    } else {
      setNewChannelError('Could not create channel — name may already be taken.')
    }
  }

  async function handleSelectUser(targetUserId: string) {
    setDmError(null)
    const result = await createOrGetDm(workspaceId, targetUserId)
    if (result.error) {
      setDmError(result.error)
      return
    }
    setNewDmOpen(false)
    void refresh()
    router.push(`/${workspaceSlug}/dm/${result.conversationId}`)
  }

  function handleSearchNavigate(channelId?: string, conversationId?: string) {
    if (channelId) {
      router.push(`/${workspaceSlug}/channel/${channelId}`)
    } else if (conversationId) {
      router.push(`/${workspaceSlug}/dm/${conversationId}`)
    }
  }

  function handleNotifNavigate(n: import('@/types').Notification) {
    setNotifOpen(false)
    if (n.channel_id) {
      router.push(`/${workspaceSlug}/channel/${n.channel_id}`)
    } else if (n.conversation_id) {
      router.push(`/${workspaceSlug}/dm/${n.conversation_id}`)
    }
  }

  // Derived lists
  const starredChannels = channels.filter(ch => ch.is_starred)
  const starredDms      = dms.filter(dm => dm.is_starred)
  const hasStarred      = starredChannels.length > 0 || starredDms.length > 0

  const sortedChannels  = [...channels].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1
    if (!a.is_pinned && b.is_pinned) return 1
    return a.name.localeCompare(b.name)
  })

  return (
    <>
      <aside className="w-64 flex-shrink-0 h-screen flex flex-col bg-sidebar-bg overflow-hidden border-r border-sidebar-border shadow-xl">

        {/* Workspace header */}
        <div className="px-4 py-3 border-b border-sidebar-border">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setWsSettingsOpen(true)}
              className="flex items-center gap-2 text-white hover:text-brand-light
                               transition-colors min-w-0"
            >
              <span className="font-semibold text-[15px] truncate">{workspaceName}</span>
              <ChevronDown size={14} className="flex-shrink-0 text-sidebar-muted" />
            </button>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setSearchOpen(true)}
                className="p-1.5 rounded-md text-sidebar-muted hover:text-sidebar-text
                           hover:bg-sidebar-hover transition-colors"
                title="Search (⌘K)"
              >
                <Search size={16} />
              </button>
              <button
                onClick={() => setNotifOpen(v => !v)}
                className="relative p-1.5 rounded-md text-sidebar-muted hover:text-sidebar-text
                           hover:bg-sidebar-hover transition-colors"
                title="Notifications"
              >
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px]
                                   bg-red-500 text-white text-[9px] font-bold rounded-full
                                   flex items-center justify-center px-0.5 leading-none">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <nav className="flex-1 overflow-y-auto sidebar-scroll py-3 flex flex-col gap-4">

          {/* Loading skeleton */}
          {loading && (
            <div className="px-3 space-y-3 animate-pulse">
              <div className="h-3 w-20 bg-sidebar-hover rounded mt-1" />
              {[1,2,3].map(i => <div key={i} className="h-7 bg-sidebar-hover rounded-lg" />)}
              <div className="h-3 w-24 bg-sidebar-hover rounded mt-3" />
              {[1,2].map(i => <div key={i} className="h-7 bg-sidebar-hover rounded-lg" />)}
            </div>
          )}

          {/* Starred section */}
          {!loading && hasStarred && (
            <section>
              <button
                onClick={() => setStarredOpen(v => !v)}
                className="flex items-center justify-between w-full px-4 mb-1
                           text-sidebar-muted hover:text-sidebar-text transition-colors"
              >
                <span className="text-[11px] font-semibold uppercase tracking-widest">
                  Starred
                </span>
                <ChevronDown
                  size={12}
                  className={cn('transition-transform', starredOpen ? '' : '-rotate-90')}
                />
              </button>

              {starredOpen && (
                <ul className="space-y-0.5 px-2">
                  {starredChannels.map(ch => (
                    <li key={`starred-ch-${ch.id}`}>
                      <Link
                        href={`/${workspaceSlug}/channel/${ch.id}`}
                        className={cn('sidebar-item', isChannelActive(ch) && 'active')}
                      >
                        <Hash size={15} className="flex-shrink-0" />
                        <span className="truncate">{ch.name}</span>
                        {(ch.unread_count ?? 0) > 0 && (
                          <span className="ml-auto unread-badge">{ch.unread_count}</span>
                        )}
                      </Link>
                    </li>
                  ))}
                  {starredDms.map(dm => {
                    const other = dm.members[0]
                    if (!other) return null
                    const displayName = other.full_name ?? other.username
                    return (
                      <li key={`starred-dm-${dm.id}`}>
                        <Link
                          href={`/${workspaceSlug}/dm/${dm.id}`}
                          className={cn('sidebar-item', isDmActive(dm.id) && 'active')}
                        >
                          <Avatar
                            src={other.avatar_url}
                            username={other.username}
                            size="xs"
                            showStatus
                            status={other.status}
                            isDnd={other.is_dnd}
                          />
                          <span className="truncate">{displayName}</span>
                          {(dm.unread_count ?? 0) > 0 && (
                            <span className="ml-auto unread-badge">{dm.unread_count}</span>
                          )}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )}

          {/* Channels section */}
          {!loading && <section>
            <button
              onClick={() => setChannelsOpen(v => !v)}
              className="flex items-center justify-between w-full px-4 mb-1
                         text-sidebar-muted hover:text-sidebar-text transition-colors"
            >
              <span className="text-[11px] font-semibold uppercase tracking-widest">
                Channels
              </span>
              <ChevronDown
                size={12}
                className={cn('transition-transform', channelsOpen ? '' : '-rotate-90')}
              />
            </button>

            {channelsOpen && (
              <ul className="space-y-0.5 px-2">
                {sortedChannels.map(ch => (
                  <li key={ch.id} className="group/ch relative">
                    <Link
                      href={`/${workspaceSlug}/channel/${ch.id}`}
                      className={cn(
                        'sidebar-item pr-16',
                        isChannelActive(ch) && 'active'
                      )}
                    >
                      {ch.logo_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={ch.logo_url} alt={ch.name} className="w-4 h-4 rounded object-cover flex-shrink-0" />
                        : ch.is_pinned
                          ? <Pin size={13} className="flex-shrink-0 text-brand" />
                          : <Hash size={15} className="flex-shrink-0" />
                      }
                      <span className="truncate">{ch.name}</span>
                      {(ch.unread_count ?? 0) > 0 && (
                        <span className="ml-auto unread-badge">{ch.unread_count}</span>
                      )}
                    </Link>
                    {/* Hover actions */}
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover/ch:flex items-center gap-0.5">
                      <button
                        onClick={e => { e.preventDefault(); void starChannel(ch.id, !ch.is_starred) }}
                        title={ch.is_starred ? 'Unstar' : 'Star'}
                        className={cn(
                          'p-0.5 rounded transition-colors',
                          ch.is_starred
                            ? 'text-yellow-400 hover:text-yellow-500'
                            : 'text-sidebar-muted hover:text-sidebar-text'
                        )}
                      >
                        <Star size={12} fill={ch.is_starred ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        onClick={e => { e.preventDefault(); void pinChannel(ch.id, !ch.is_pinned) }}
                        title={ch.is_pinned ? 'Unpin' : 'Pin to top'}
                        className={cn(
                          'p-0.5 rounded transition-colors',
                          ch.is_pinned
                            ? 'text-brand hover:text-brand-dark'
                            : 'text-sidebar-muted hover:text-sidebar-text'
                        )}
                      >
                        <Pin size={12} />
                      </button>
                    </div>
                  </li>
                ))}

                {/* Add channel */}
                <li>
                  {newChannelOpen ? (
                    <form onSubmit={e => void handleCreateChannel(e)} className="px-1 py-1 flex flex-col gap-1">
                      <input
                        autoFocus
                        type="text"
                        placeholder="new-channel"
                        value={newChannelName}
                        disabled={newChannelBusy}
                        onChange={e => { setNewChannelName(e.target.value); setNewChannelError(null) }}
                        onBlur={() => { if (!newChannelName) cancelNewChannel() }}
                        onKeyDown={e => { if (e.key === 'Escape') cancelNewChannel() }}
                        className="w-full rounded-md bg-sidebar-active border-0
                                   text-sidebar-text text-sm px-2 py-1
                                   placeholder:text-sidebar-muted focus:outline-none
                                   focus:ring-1 focus:ring-brand disabled:opacity-50"
                      />
                      {newChannelError && (
                        <p className="text-[10px] text-red-400 px-1 leading-tight">{newChannelError}</p>
                      )}
                    </form>
                  ) : (
                    <button
                      onClick={() => setNewChannelOpen(true)}
                      className="sidebar-item w-full text-sidebar-muted hover:text-sidebar-text"
                    >
                      <Plus size={14} />
                      <span className="text-sm">Add channel</span>
                    </button>
                  )}
                </li>

                {/* Archived channels toggle */}
                <li>
                  <button
                    onClick={async () => {
                      if (!archivedOpen) {
                        setArchivedLoading(true)
                        const data = await fetchArchivedChannels()
                        setArchivedChannels(data)
                        setArchivedLoading(false)
                      }
                      setArchivedOpen(v => !v)
                    }}
                    className="sidebar-item w-full text-sidebar-muted hover:text-sidebar-text"
                  >
                    <Archive size={13} />
                    <span className="text-sm">Archived channels</span>
                    <ChevronDown size={11} className={cn('ml-auto transition-transform', archivedOpen ? '' : '-rotate-90')} />
                  </button>
                </li>

                {/* Archived list */}
                {archivedOpen && (
                  archivedLoading ? (
                    <li className="px-4 py-2">
                      <div className="h-3 w-24 bg-sidebar-hover rounded animate-pulse" />
                    </li>
                  ) : archivedChannels.length === 0 ? (
                    <li className="px-4 py-1.5 text-[11px] text-sidebar-muted italic">No archived channels</li>
                  ) : archivedChannels.map(ch => (
                    <li key={ch.id} className="group/arch relative">
                      <div className="sidebar-item text-sidebar-muted pr-10 cursor-default opacity-60">
                        <Archive size={13} className="flex-shrink-0" />
                        <span className="truncate text-sm">{ch.name}</span>
                      </div>
                      <button
                        onClick={async () => {
                          await unarchiveChannel(ch.id)
                          setArchivedChannels(prev => prev.filter(c => c.id !== ch.id))
                          if (archivedChannels.length === 1) setArchivedOpen(false)
                        }}
                        title="Unarchive channel"
                        className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover/arch:flex
                                   items-center gap-1 text-[10px] text-sidebar-muted hover:text-brand-light
                                   bg-sidebar-hover px-1.5 py-0.5 rounded transition-colors"
                      >
                        <ArchiveRestore size={11} />
                        Restore
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </section>}

          {/* Direct messages section */}
          {!loading && <section>
            <button
              onClick={() => setDmsOpen(v => !v)}
              className="flex items-center justify-between w-full px-4 mb-1
                         text-sidebar-muted hover:text-sidebar-text transition-colors"
            >
              <span className="text-[11px] font-semibold uppercase tracking-widest">
                Direct Messages
              </span>
              <ChevronDown
                size={12}
                className={cn('transition-transform', dmsOpen ? '' : '-rotate-90')}
              />
            </button>

            {dmsOpen && (
              <ul className="space-y-0.5 px-2">
                {dms.map(dm => {
                  const other = dm.members[0]
                  if (!other) return null
                  const displayName = other.full_name ?? other.username
                  return (
                    <li key={dm.id} className="group/dm relative">
                      <Link
                        href={`/${workspaceSlug}/dm/${dm.id}`}
                        className={cn(
                          'sidebar-item pr-10',
                          isDmActive(dm.id) && 'active'
                        )}
                      >
                        <Avatar
                          src={other.avatar_url}
                          username={other.username}
                          size="xs"
                          showStatus
                          status={other.status}
                          isDnd={other.is_dnd}
                        />
                        <span className="truncate">{displayName}</span>
                        {(dm.unread_count ?? 0) > 0 && (
                          <span className="ml-auto unread-badge">{dm.unread_count}</span>
                        )}
                      </Link>
                      {/* Hover star */}
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover/dm:flex items-center">
                        <button
                          onClick={e => { e.preventDefault(); void starDm(dm.id, !dm.is_starred) }}
                          title={dm.is_starred ? 'Unstar' : 'Star'}
                          className={cn(
                            'p-0.5 rounded transition-colors',
                            dm.is_starred
                              ? 'text-yellow-400 hover:text-yellow-500'
                              : 'text-sidebar-muted hover:text-sidebar-text'
                          )}
                        >
                          <Star size={12} fill={dm.is_starred ? 'currentColor' : 'none'} />
                        </button>
                      </div>
                    </li>
                  )
                })}

                <li>
                  <button
                    className="sidebar-item w-full text-sidebar-muted hover:text-sidebar-text"
                    onClick={() => setNewDmOpen(true)}
                  >
                    <Plus size={14} />
                    <MessageSquare size={14} />
                    <span className="text-sm">New message</span>
                  </button>
                </li>
              </ul>
            )}
          </section>}
        </nav>

        {/* User footer */}
        <div className="px-4 py-3 border-t border-sidebar-border relative">
          {/* Switcher Popover */}
          {switcherOpen && (
            <div className="absolute bottom-[calc(100%+8px)] left-0 w-full z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <WorkspaceSwitcher
                currentWorkspaceId={workspaceId}
                userId={userId}
                onClose={() => setSwitcherOpen(false)}
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button
              onClick={() => setSwitcherOpen(!switcherOpen)}
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-sidebar-hover transition-all group"
            >
              <Avatar
                src={profile?.avatar_url}
                username={profile?.username ?? 'me'}
                size="sm"
                showStatus
                status={profile?.status ?? 'available'}
                isDnd={profile?.is_dnd}
              />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-sidebar-text truncate">
                  {profile?.full_name ?? profile?.username}
                </p>
                <p className="text-xs text-sidebar-muted truncate">
                  @{profile?.username}
                </p>
              </div>
              <ChevronDown size={14} className={cn('text-sidebar-muted transition-transform duration-200', switcherOpen && 'rotate-180')} />
            </button>

            <div className="flex items-center gap-1">
              <Link
                href="/settings"
                className="p-1.5 rounded-md text-sidebar-muted hover:text-sidebar-text
                           hover:bg-sidebar-hover transition-colors"
                title="Settings"
              >
                <Settings size={15} />
              </Link>
              <button
                onClick={() => void signOut()}
                className="p-1.5 rounded-md text-sidebar-muted hover:text-red-400
                           hover:bg-sidebar-hover transition-colors"
                title="Sign out"
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <NewDmModal
        isOpen={newDmOpen}
        onClose={() => { setNewDmOpen(false); setDmError(null) }}
        members={members.map(m => m.profile).filter(Boolean) as import('@/types').Profile[]}
        onSelect={handleSelectUser}
        currentUserId={userId}
        error={dmError}
      />

      <WorkspaceSettingsModal
        isOpen={wsSettingsOpen}
        onClose={() => setWsSettingsOpen(false)}
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        currentUserId={userId}
        currentUserRole={currentUserRole}
      />

      <SearchModal
        isOpen={searchOpen}
        workspaceId={workspaceId}
        onClose={() => setSearchOpen(false)}
        onNavigate={handleSearchNavigate}
      />

      {notifOpen && (
        <NotificationsPanel
          notifications={notifications}
          loading={false}
          onMarkRead={markRead}
          onMarkAllRead={markAllRead}
          onNavigate={handleNotifNavigate}
          onClose={() => setNotifOpen(false)}
        />
      )}
    </>
  )
}
