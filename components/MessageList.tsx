'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Eye, Flame, Lock, MoreHorizontal, Pencil, Pin, ShieldOff, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { Avatar } from '@/components/Avatar'
import { EmojiFloat } from '@/components/EmojiFloat'
import { EmojiPickerPopover } from '@/components/EmojiPicker'
import { PollMessage } from '@/components/PollMessage'
import { formatTime, formatDate } from '@/lib/utils'
import type { Message, MessageReaction } from '@/types'

// ── Common quick-reaction emojis ───────────────────────────────────────────
const QUICK_REACTIONS = ['👍', '❤️', '😂', '🔥', '😮', '😢', '🎉', '👀']

// ── Single-emoji detection ─────────────────────────────────────────────────
function isSingleEmoji(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  try {
    const seg  = new (Intl as any).Segmenter(undefined, { granularity: 'grapheme' })
    const segs = [...seg.segment(trimmed)]
    if (segs.length !== 1) return false
    return /\p{Emoji}/u.test(trimmed)
  } catch {
    return /^(\p{Emoji_Presentation}|\p{Emoji}️)[\p{Emoji_Modifier}]?$/u.test(trimmed)
  }
}

// ── Group consecutive messages from same sender within 5 min ──────────────
function groupMessages(messages: Message[]) {
  const groups: { date: string; bursts: { sender: Message['sender']; messages: Message[] }[] }[] = []

  let currentDate  = ''
  let currentBursts: typeof groups[0]['bursts'] = []
  let lastBurst:    typeof currentBursts[0] | null = null
  let lastSenderId = ''
  let lastTime     = 0

  for (const msg of messages) {
    const date = formatDate(msg.created_at)
    if (date !== currentDate) {
      if (currentDate) groups.push({ date: currentDate, bursts: currentBursts })
      currentDate   = date
      currentBursts = []
      lastBurst     = null
      lastSenderId  = ''
      lastTime      = 0
    }

    const msgTime    = new Date(msg.created_at).getTime()
    const sameSender = msg.sender_id === lastSenderId
    const within5Min = msgTime - lastTime < 5 * 60 * 1000

    if (sameSender && within5Min && lastBurst) {
      lastBurst.messages.push(msg)
    } else {
      lastBurst = { sender: msg.sender, messages: [msg] }
      currentBursts.push(lastBurst)
    }

    lastSenderId = msg.sender_id
    lastTime     = msgTime
  }

  if (currentDate) groups.push({ date: currentDate, bursts: currentBursts })
  return groups
}

// ── Mention rendering ──────────────────────────────────────────────────────
function renderContent(text: string, currentUsername: string) {
  const parts = text.split(/(@\w+)/g)
  return parts.map((part, i) => {
    if (!part.startsWith('@')) return <span key={i}>{part}</span>
    const uname = part.slice(1)
    const isMe  = uname.toLowerCase() === currentUsername.toLowerCase()
    return (
      <span key={i}
        className={`inline-flex items-center rounded px-0.5 font-semibold
          ${isMe
            ? 'bg-amber-100 text-amber-700'
            : 'bg-brand-faint text-brand-dark'
          }`}
      >
        {part}
      </span>
    )
  })
}

// ── Props ──────────────────────────────────────────────────────────────────
interface MessageListProps {
  messages:        Message[]
  loading:         boolean
  hasMore:         boolean
  loadMore:        () => Promise<void>
  currentUserId:   string
  currentUsername: string
  blockedIds?:     Set<string>
  mutedIds?:       Set<string>
  onEdit:          (id: string, content: string) => Promise<void>
  onDelete:        (id: string) => Promise<void>
  onPin?:          (id: string, isPinned: boolean) => Promise<void>
  onReact?:        (messageId: string, emoji: string) => Promise<void>
  onOneTimeView?:  (messageId: string) => Promise<void>
  onBlock?:        (userId: string) => Promise<void>
  onViewProfile?:  (userId: string) => void
}

export function MessageList({
  messages,
  loading,
  hasMore,
  loadMore,
  currentUserId,
  currentUsername,
  blockedIds,
  mutedIds,
  onEdit,
  onDelete,
  onPin,
  onReact,
  onOneTimeView,
  onBlock,
  onViewProfile,
}: MessageListProps) {
  const bottomRef  = useRef<HTMLDivElement>(null)
  const prevLenRef = useRef(0)

  useEffect(() => {
    if (messages.length > prevLenRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevLenRef.current = messages.length
  }, [messages.length])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <span key={i} className="w-2 h-2 rounded-full bg-brand animate-bounce"
              style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-ink-4">
        <span className="text-3xl">💬</span>
        <p className="text-sm">No messages yet. Start the conversation!</p>
      </div>
    )
  }

  const groups = groupMessages(messages)

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-0">
      {hasMore && (
        <button onClick={() => void loadMore()}
          className="self-center mb-4 text-xs text-brand-dark hover:underline">
          Load older messages
        </button>
      )}

      {groups.map(({ date, bursts }) => (
        <div key={date}>
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-surface-3" />
            <span className="text-xs text-ink-4 font-medium px-2">{date}</span>
            <div className="flex-1 h-px bg-surface-3" />
          </div>

          {bursts.map((burst, bi) => {
            // Blocked sender — show a clickable placeholder to unblock
            if (blockedIds?.has(burst.messages[0].sender_id)) {
              return (
                <button
                  key={`${date}-${bi}`}
                  onClick={() => onViewProfile?.(burst.messages[0].sender_id)}
                  className="flex items-center gap-2 px-2 py-1 w-full text-left
                             hover:bg-surface rounded-lg transition-colors group"
                >
                  <ShieldOff size={12} className="text-ink-4 flex-shrink-0" />
                  <span className="text-xs text-ink-4 italic">Message from a blocked user</span>
                  <span className="text-xs text-brand opacity-0 group-hover:opacity-100
                                   transition-opacity ml-1">
                    · click to unblock
                  </span>
                </button>
              )
            }
            const isMuted = mutedIds?.has(burst.messages[0].sender_id) ?? false
            return (
              <MessageBurst
                key={`${date}-${bi}`}
                burst={burst}
                currentUserId={currentUserId}
                currentUsername={currentUsername}
                isMuted={isMuted}
                onEdit={onEdit}
                onDelete={onDelete}
                onPin={onPin}
                onReact={onReact}
                onOneTimeView={onOneTimeView}
                onBlock={onBlock}
                onViewProfile={onViewProfile}
              />
            )
          })}
        </div>
      ))}

      <div ref={bottomRef} />
    </div>
  )
}

// ── Burst ──────────────────────────────────────────────────────────────────

interface Burst {
  sender:   Message['sender']
  messages: Message[]
}

function MessageBurst({
  burst,
  currentUserId,
  currentUsername,
  isMuted,
  onEdit,
  onDelete,
  onPin,
  onReact,
  onOneTimeView,
  onBlock,
  onViewProfile,
}: {
  burst:           Burst
  currentUserId:   string
  currentUsername: string
  isMuted?:        boolean
  onEdit:          (id: string, content: string) => Promise<void>
  onDelete:        (id: string) => Promise<void>
  onPin?:          (id: string, isPinned: boolean) => Promise<void>
  onReact?:        (messageId: string, emoji: string) => Promise<void>
  onOneTimeView?:  (messageId: string) => Promise<void>
  onBlock?:        (userId: string) => Promise<void>
  onViewProfile?:  (userId: string) => void
}) {
  const { sender, messages } = burst
  const displayName = sender?.full_name ?? sender?.username ?? 'Unknown'

  return (
    <div className={`msg-row group flex gap-3 px-2 py-0.5 hover:bg-surface rounded-lg transition-colors ${isMuted ? 'opacity-50' : ''}`}>
      {/* Clickable avatar → opens user profile */}
      <button
        className="flex-shrink-0 pt-0.5 rounded-lg hover:ring-2 hover:ring-brand/30 transition-all"
        onClick={() => sender?.id && onViewProfile?.(sender.id)}
        title={`View ${displayName}'s profile`}
      >
        <Avatar src={sender?.avatar_url} username={sender?.username ?? '?'} size="md" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          {/* Clickable name → opens user profile */}
          <button
            className="font-semibold text-sm text-ink hover:underline"
            onClick={() => sender?.id && onViewProfile?.(sender.id)}
          >
            {displayName}
          </button>
          <span className="text-xs text-ink-4">{formatTime(messages[0].created_at)}</span>
          {isMuted && (
            <span className="text-[10px] text-ink-4 bg-surface px-1.5 py-0.5 rounded-full">muted</span>
          )}
        </div>
        {messages.map(msg => (
          <MessageRow
            key={msg.id}
            message={msg}
            isOwn={msg.sender_id === currentUserId}
            currentUserId={currentUserId}
            currentUsername={currentUsername}
            onEdit={onEdit}
            onDelete={onDelete}
            onPin={onPin}
            onReact={onReact}
            onOneTimeView={onOneTimeView}
            onBlock={msg.sender_id !== currentUserId ? onBlock : undefined}
            blockUserId={msg.sender_id}
          />
        ))}
      </div>
    </div>
  )
}

// ── Row ────────────────────────────────────────────────────────────────────

function MessageRow({
  message,
  isOwn,
  currentUserId,
  currentUsername,
  onEdit,
  onDelete,
  onPin,
  onReact,
  onOneTimeView,
  onBlock,
  blockUserId,
}: {
  message:         Message
  isOwn:           boolean
  currentUserId:   string
  currentUsername: string
  onEdit:         (id: string, content: string) => Promise<void>
  onDelete:       (id: string) => Promise<void>
  onPin?:         (id: string, isPinned: boolean) => Promise<void>
  onReact?:       (messageId: string, emoji: string) => Promise<void>
  onOneTimeView?: (messageId: string) => Promise<void>
  onBlock?:       (userId: string) => Promise<void>
  blockUserId?:   string
}) {
  const [editing,     setEditing]     = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const [saving,      setSaving]      = useState(false)
  const [pickerOpen,  setPickerOpen]  = useState(false)
  const [moreOpen,    setMoreOpen]    = useState(false)
  const [revealed,    setRevealed]    = useState(false)

  const mountRef  = useRef(true)
  const isNew     = mountRef.current
  useEffect(() => { mountRef.current = false }, [])

  if (message.is_deleted) {
    return <p className="text-sm text-ink-4 italic py-0.5">This message was deleted.</p>
  }

  // ── One-time logic ─────────────────────────────────────────────────────
  const viewedBy    = message.viewed_by ?? []
  const alreadySeen = viewedBy.includes(currentUserId)

  async function handleReveal() {
    if (revealed || alreadySeen) return
    setRevealed(true)
    if (onOneTimeView) await onOneTimeView(message.id)
  }

  // ── Edit mode ──────────────────────────────────────────────────────────
  async function commitEdit() {
    const trimmed = editContent.trim()
    if (!trimmed || trimmed === message.content) { setEditing(false); return }
    setSaving(true)
    await onEdit(message.id, trimmed)
    setSaving(false)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="py-0.5">
        <textarea
          autoFocus
          value={editContent}
          onChange={e => setEditContent(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void commitEdit() }
            if (e.key === 'Escape') { setEditing(false); setEditContent(message.content) }
          }}
          rows={1}
          disabled={saving}
          className="w-full text-sm text-ink bg-surface border border-brand/40 rounded-lg
                     px-3 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-brand/20
                     leading-relaxed disabled:opacity-60"
        />
        <div className="flex items-center gap-2 mt-1">
          <button onClick={() => void commitEdit()} disabled={saving}
            className="flex items-center gap-1 text-xs text-brand-dark hover:underline disabled:opacity-50">
            <Check size={12} /> Save
          </button>
          <button onClick={() => { setEditing(false); setEditContent(message.content) }}
            className="flex items-center gap-1 text-xs text-ink-4 hover:underline">
            <X size={12} /> Cancel
          </button>
          <span className="text-[10px] text-ink-4 ml-1">Enter to save · Esc to cancel</span>
        </div>
      </div>
    )
  }

  // ── Reaction summary ───────────────────────────────────────────────────
  const reactions = message.reactions ?? []
  const reactionMap = reactions.reduce<Record<string, { count: number; hasMe: boolean }>>((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, hasMe: false }
    acc[r.emoji].count++
    if (r.user_id === currentUserId) acc[r.emoji].hasMe = true
    return acc
  }, {})

  const isPoll      = !!message.poll
  const singleEmoji = !isPoll && isSingleEmoji(message.content)

  // ── One-time: unrevealed / already viewed ──────────────────────────────
  if (message.is_one_time && !isOwn && !revealed && !alreadySeen) {
    return (
      <div className="py-0.5">
        <div
          onClick={() => void handleReveal()}
          className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-lg
                     bg-orange-50 border border-orange-200 text-orange-700 text-sm
                     hover:bg-orange-100 transition-colors select-none"
        >
          <Flame size={14} className="text-orange-500" />
          <span className="font-medium">One-time message</span>
          <Eye size={13} />
          <span className="text-xs text-orange-500">Tap to reveal</span>
        </div>
      </div>
    )
  }

  if (message.is_one_time && !isOwn && alreadySeen && !revealed) {
    return (
      <p className="text-sm text-ink-4 italic py-0.5 flex items-center gap-1.5">
        <Flame size={12} className="text-orange-400" />
        You&apos;ve already viewed this one-time message.
      </p>
    )
  }

  return (
    <div className="group/msg py-0.5 relative">

      {/* Poll */}
      {isPoll && message.poll && (
        <div className="mt-1 mb-1">
          <PollMessage poll={message.poll} currentUserId={currentUserId} />
        </div>
      )}

      {/* Text content (skip if pure poll placeholder or pure emoji) */}
      {!isPoll && (
        singleEmoji ? (
          <div className="py-2">
            <EmojiFloat emoji={message.content.trim()} animate={isNew} />
            {message.is_one_time && isOwn && (
              <span className="ml-3 text-xs text-orange-500 align-middle">
                <Flame size={11} className="inline mr-0.5" />
                one-time · {viewedBy.length} viewed
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-ink-2 leading-relaxed whitespace-pre-wrap break-words">
            {renderContent(message.content, currentUsername)}
            {message.edited_at && <span className="text-xs text-ink-4 ml-1">(edited)</span>}
            {message.is_pinned && <span className="text-xs text-amber-500 ml-1" title="Pinned">📌</span>}
            {message.is_one_time && isOwn && (
              <span className="ml-2 text-xs text-orange-500">
                <Flame size={11} className="inline mr-0.5" />
                one-time · {viewedBy.length} viewed
              </span>
            )}
          </p>
        )
      )}

      {/* Attachments */}
      {message.attachments && message.attachments.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-2">
          {message.attachments.map(att => (
            <AttachmentChip
              key={att.id}
              attachment={att}
              isRestricted={message.is_restricted}
              isOwn={isOwn}
            />
          ))}
        </div>
      )}

      {/* Reactions */}
      {Object.keys(reactionMap).length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {Object.entries(reactionMap).map(([emoji, { count, hasMe }]) => (
            <button
              key={emoji}
              onClick={() => onReact && void onReact(message.id, emoji)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all
                ${hasMe
                  ? 'bg-brand-faint border-brand text-brand-dark font-medium'
                  : 'bg-white border-surface-3 text-ink-3 hover:border-brand/40 hover:bg-brand-faint/50'
                }`}
              title={hasMe ? 'Remove reaction' : `React with ${emoji}`}
            >
              <span>{emoji}</span>
              <span>{count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Hover action bar */}
      <div className="absolute right-0 top-0 hidden group-hover/msg:flex items-center
                      gap-0.5 bg-white border border-surface-3 rounded-lg shadow-sm px-1 py-0.5
                      -translate-y-1 z-10">
        {onReact && (
          <div className="relative">
            <button
              onClick={() => setPickerOpen(v => !v)}
              title="React"
              className="p-1 rounded transition-colors text-ink-4 hover:text-brand hover:bg-surface text-base leading-none"
            >
              😊
            </button>
            {pickerOpen && (
              <EmojiPicker
                onPick={emoji => {
                  setPickerOpen(false)
                  void onReact(message.id, emoji)
                }}
                onClose={() => setPickerOpen(false)}
              />
            )}
          </div>
        )}

        {onPin && (
          <button
            onClick={() => void onPin(message.id, !message.is_pinned)}
            title={message.is_pinned ? 'Unpin' : 'Pin message'}
            className={`p-1 rounded transition-colors ${
              message.is_pinned
                ? 'text-amber-500 hover:text-amber-600 hover:bg-surface'
                : 'text-ink-4 hover:text-amber-500 hover:bg-surface'
            }`}
          >
            <Pin size={13} />
          </button>
        )}

        {isOwn && (
          <>
            <button
              onClick={() => { setEditing(true); setEditContent(message.content) }}
              title="Edit"
              className="p-1 rounded text-ink-4 hover:text-brand hover:bg-surface transition-colors"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={() => void onDelete(message.id)}
              title="Delete"
              className="p-1 rounded text-ink-4 hover:text-red-500 hover:bg-surface transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </>
        )}

        {/* ⋯ More menu — Block user lives here */}
        {!isOwn && onBlock && blockUserId && (
          <div className="relative">
            <button
              onClick={() => setMoreOpen(v => !v)}
              title="More options"
              className="p-1 rounded text-ink-4 hover:text-ink hover:bg-surface transition-colors"
            >
              <MoreHorizontal size={13} />
            </button>
            {moreOpen && (
              <>
                {/* backdrop to close */}
                <div className="fixed inset-0 z-20" onClick={() => setMoreOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-30 bg-white border border-surface-3
                                rounded-lg shadow-lg py-1 min-w-[160px]">
                  <button
                    onClick={() => {
                      setMoreOpen(false)
                      void onBlock(blockUserId)
                    }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-600
                               hover:bg-red-50 transition-colors"
                  >
                    <ShieldOff size={14} />
                    Block user
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Emoji quick-picker ────────────────────────────────────────────────────

function EmojiPicker({ onPick, onClose }: { onPick: (e: string) => void; onClose: () => void }) {
  const [fullOpen, setFullOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute bottom-full right-0 mb-1 z-20 animate-fade-in"
      onMouseDown={e => e.stopPropagation()}
    >
      {fullOpen ? (
        <EmojiPickerPopover
          onSelect={e => { onPick(e); onClose() }}
          onClose={() => setFullOpen(false)}
          className="bottom-full right-0 mb-1 static"
        />
      ) : (
        <div className="flex gap-1 bg-white border border-surface-3 rounded-xl shadow-lg p-1.5">
          {QUICK_REACTIONS.map(e => (
            <button
              key={e}
              onClick={() => onPick(e)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-lg
                         hover:bg-surface transition-colors hover:scale-110 active:scale-95"
            >
              {e}
            </button>
          ))}
          <button
            onClick={() => setFullOpen(true)}
            title="More emojis"
            className="w-8 h-8 flex items-center justify-center rounded-lg
                       text-ink-4 hover:text-brand hover:bg-surface transition-colors"
          >
            <MoreHorizontal size={15} />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Attachment chip ────────────────────────────────────────────────────────
// isRestricted + !isOwn  → show content but NO download / open link
// isRestricted + isOwn   → show content with download (sender can always access)
// !isRestricted          → show content with download

function AttachmentChip({
  attachment,
  isRestricted = false,
  isOwn = false,
}: {
  attachment:    { id: string; name: string; url: string; mime_type: string }
  isRestricted?: boolean
  isOwn?:        boolean
}) {
  const isImage    = attachment.mime_type.startsWith('image/')
  const isVideo    = attachment.mime_type.startsWith('video/')
  const canDownload = !isRestricted || isOwn   // owner can always download

  const restrictedBadge = (
    <div className="absolute top-1 right-1 flex items-center gap-1 bg-black/60 text-white
                    text-[10px] font-medium px-1.5 py-0.5 rounded-full pointer-events-none">
      <Lock size={9} /> View only
    </div>
  )

  // ── Image ────────────────────────────────────────────────────────────────
  if (isImage) {
    if (!canDownload) {
      // Restricted: render via CSS background so right-click "Save image as" is unavailable
      return (
        <div className="relative select-none">
          <div
            style={{ backgroundImage: `url(${attachment.url})` }}
            className="w-64 h-44 rounded-lg bg-cover bg-center bg-no-repeat border border-surface-3"
            onContextMenu={e => e.preventDefault()}
          />
          {restrictedBadge}
        </div>
      )
    }
    return (
      <div className="relative group/img">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attachment.url}
          alt={attachment.name}
          className="max-w-xs max-h-48 rounded-lg object-cover border border-surface-3"
        />
        <a
          href={attachment.url}
          download={attachment.name}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 flex items-end justify-end p-2 opacity-0
                     group-hover/img:opacity-100 transition-opacity rounded-lg bg-black/10"
        >
          <span className="bg-black/60 text-white text-[11px] px-2 py-0.5 rounded-full">
            Download
          </span>
        </a>
      </div>
    )
  }

  // ── Video ────────────────────────────────────────────────────────────────
  if (isVideo) {
    return (
      <div className="relative">
        {/* controlsList="nodownload" removes the browser's built-in download button */}
        <video
          src={attachment.url}
          controls
          controlsList={canDownload ? undefined : 'nodownload'}
          onContextMenu={canDownload ? undefined : e => e.preventDefault()}
          className="max-w-xs max-h-48 rounded-lg border border-surface-3"
        />
        {isRestricted && !isOwn && (
          <div className="absolute top-1 right-1 flex items-center gap-1 bg-black/60 text-white
                          text-[10px] font-medium px-1.5 py-0.5 rounded-full pointer-events-none">
            <Lock size={9} /> View only
          </div>
        )}
      </div>
    )
  }

  // ── Generic file ─────────────────────────────────────────────────────────
  // Always allow opening in a new tab (viewing).
  // Only add the `download` attribute — and show a download button — when canDownload.
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      {...(canDownload ? { download: attachment.name } : {})}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors
        ${canDownload
          ? 'bg-surface border-surface-3 text-ink-2 hover:border-brand hover:text-brand-dark'
          : 'bg-amber-50 border-amber-200 text-amber-700 hover:border-amber-400'
        }`}
    >
      {canDownload ? <span>📎</span> : <Lock size={14} className="flex-shrink-0 text-amber-500" />}
      <span className="truncate max-w-[160px]">{attachment.name}</span>
      {!canDownload && (
        <span className="text-[10px] text-amber-500 flex-shrink-0 font-medium">View only</span>
      )}
    </a>
  )
}
