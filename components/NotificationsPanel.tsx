'use client'

import { useEffect, useRef } from 'react'
import { AtSign, Bell, Check, MessageSquare, X } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { formatTime } from '@/lib/utils'
import type { Notification } from '@/types'

interface NotificationsPanelProps {
  notifications: Notification[]
  loading:       boolean
  onMarkRead:    (id: string) => void
  onMarkAllRead: () => void
  onNavigate:    (n: Notification) => void
  onClose:       () => void
}

export function NotificationsPanel({
  notifications,
  loading,
  onMarkRead,
  onMarkAllRead,
  onNavigate,
  onClose,
}: NotificationsPanelProps) {
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => { clearTimeout(id); document.removeEventListener('mousedown', handler) }
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const unread = notifications.filter(n => !n.is_read)

  return (
    <div
      ref={ref}
      className="fixed left-64 top-0 bottom-0 w-80 z-50 bg-white shadow-2xl
                 flex flex-col border-r border-surface-3 animate-slide-in-right"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-ink-3" />
          <h2 className="font-semibold text-ink text-sm">Notifications</h2>
          {unread.length > 0 && (
            <span className="bg-brand text-white text-[10px] font-bold
                             min-w-[18px] h-[18px] rounded-full flex items-center
                             justify-center px-1">
              {unread.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unread.length > 0 && (
            <button
              onClick={onMarkAllRead}
              title="Mark all as read"
              className="p-1.5 rounded-md text-ink-4 hover:text-brand hover:bg-surface
                         transition-colors text-xs flex items-center gap-1"
            >
              <Check size={13} />
              <span>All read</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-ink-4 hover:bg-surface transition-colors"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 gap-1.5">
            {[0,1,2].map(i => (
              <span key={i} className="w-1.5 h-1.5 rounded-full bg-brand animate-bounce"
                style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-ink-4">
            <Bell size={28} strokeWidth={1.5} />
            <p className="text-sm">No notifications yet</p>
          </div>
        ) : (
          <ul className="divide-y divide-surface-2">
            {notifications.map(n => (
              <NotifRow
                key={n.id}
                notification={n}
                onRead={onMarkRead}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ── Single row ─────────────────────────────────────────────────────────────

function NotifRow({
  notification: n,
  onRead,
  onNavigate,
}: {
  notification: Notification
  onRead:       (id: string) => void
  onNavigate:   (n: Notification) => void
}) {
  function handleClick() {
    if (!n.is_read) onRead(n.id)
    onNavigate(n)
  }

  const sender      = n.from_user
  const displayName = sender?.full_name ?? sender?.username ?? 'Someone'
  const isMention   = n.type === 'mention'

  return (
    <li
      onClick={handleClick}
      className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors
        ${n.is_read ? 'hover:bg-surface' : 'bg-brand-faint/60 hover:bg-brand-faint'}`}
    >
      {/* Avatar with type badge */}
      <div className="relative flex-shrink-0 mt-0.5">
        <Avatar
          src={sender?.avatar_url ?? null}
          username={sender?.username ?? '?'}
          size="md"
        />
        <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full
          flex items-center justify-center text-white
          ${isMention ? 'bg-brand-dark' : 'bg-blue-500'}`}
        >
          {isMention
            ? <AtSign size={9} />
            : <MessageSquare size={9} />
          }
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs font-semibold text-ink truncate">{displayName}</span>
          {n.channel && (
            <span className="text-[10px] text-ink-4 truncate">in #{n.channel.name}</span>
          )}
          {!n.is_read && (
            <span className="ml-auto w-2 h-2 rounded-full bg-brand flex-shrink-0" />
          )}
        </div>

        <p className="text-xs text-ink-3 leading-relaxed line-clamp-2">
          {n.content_preview ?? (isMention ? 'Mentioned you' : 'Sent you a message')}
        </p>

        <p className="text-[10px] text-ink-4 mt-1">{formatTime(n.created_at)}</p>
      </div>
    </li>
  )
}
