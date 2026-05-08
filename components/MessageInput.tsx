'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { BarChart2, Flame, Paperclip, SendHorizonal, Smile } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { Avatar } from '@/components/Avatar'
import { EmojiPickerPopover } from '@/components/EmojiPicker'
import { AttachmentPreview } from '@/components/AttachmentPreview'
import { PollCreator } from '@/components/PollCreator'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types'

interface MessageInputProps {
  onSend:       (content: string, attachments?: any[], isOneTime?: boolean, pollId?: string, isRestricted?: boolean) => Promise<void>
  onPoll:       (question: string, options: string[], allowsMultiple: boolean, isAnonymous: boolean) => Promise<void>
  placeholder?: string
  workspaceId:  string
  onTyping?:    () => void
}

// ── Mention helpers ────────────────────────────────────────────────────────

function getMentionContext(text: string, cursor: number): { query: string; triggerStart: number } | null {
  const before = text.slice(0, cursor)
  const match  = before.match(/@(\w*)$/)
  if (!match) return null
  return { query: match[1], triggerStart: cursor - match[0].length }
}

export function MessageInput({
  onSend,
  onPoll,
  placeholder = 'Send a message…',
  workspaceId,
  onTyping,
}: MessageInputProps) {
  
  const supabase = createClient()

  const [content,       setContent]       = useState('')
  const [sending,       setSending]       = useState(false)
  const [uploading,     setUploading]     = useState(false)
  const [isOneTime,     setIsOneTime]     = useState(false)
  const [pickerOpen,    setPickerOpen]    = useState(false)
  const [pollOpen,      setPollOpen]      = useState(false)
  const [pendingFile,   setPendingFile]   = useState<File | null>(null)

  // Mention autocomplete state
  const [mentionQuery,  setMentionQuery]  = useState<string | null>(null)
  const [mentionStart,  setMentionStart]  = useState(0)
  const [mentionList,   setMentionList]   = useState<Pick<Profile, 'id' | 'username' | 'full_name' | 'avatar_url'>[]>([])
  const [mentionIdx,    setMentionIdx]    = useState(0)
  const mentionFetchRef = useRef<AbortController | null>(null)

  const textareaRef  = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch mention candidates
  useEffect(() => {
    if (mentionQuery === null) { setMentionList([]); return }

    mentionFetchRef.current?.abort()
    mentionFetchRef.current = new AbortController()

    const run = async () => {
      const { data } = await supabase
        .from('workspace_members')
        .select('profile:profiles!user_id(id, username, full_name, avatar_url)')
        .eq('workspace_id', workspaceId)
        .limit(8)

      if (!data) return
      const profiles = (data as any[]).map((r: any) => r.profile).filter(Boolean)
      const q = mentionQuery.toLowerCase()
      const filtered = q
        ? profiles.filter((p: Profile) =>
            p.username.toLowerCase().includes(q) ||
            (p.full_name?.toLowerCase().includes(q) ?? false)
          )
        : profiles.slice(0, 8)

      setMentionList(filtered)
      setMentionIdx(0)
    }

    void run()
  }, [mentionQuery, supabase, workspaceId])

  const insertMention = useCallback((username: string) => {
    const el = textareaRef.current
    if (!el) return
    const cursor = el.selectionStart ?? content.length
    const before = content.slice(0, mentionStart)
    const after  = content.slice(cursor)
    const next   = `${before}@${username} ${after}`
    setContent(next)
    setMentionQuery(null)
    const newCursor = mentionStart + username.length + 2
    requestAnimationFrame(() => {
      el.setSelectionRange(newCursor, newCursor)
      el.focus()
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`
    })
  }, [content, mentionStart])

  const insertEmoji = useCallback((emoji: string) => {
    const el = textareaRef.current
    if (!el) { setContent(prev => prev + emoji); return }
    const start = el.selectionStart ?? content.length
    const end   = el.selectionEnd   ?? content.length
    const next  = content.slice(0, start) + emoji + content.slice(end)
    setContent(next)
    requestAnimationFrame(() => {
      const pos = start + emoji.length
      el.setSelectionRange(pos, pos)
      el.focus()
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`
    })
  }, [content])

  const handleSend = useCallback(async () => {
    const trimmed = content.trim()
    if (!trimmed || sending) return
    setSending(true)
    const oneTime = isOneTime
    try {
      await onSend(trimmed, undefined, oneTime)
      setContent('')
      setIsOneTime(false)
      resetHeight()
    } catch (err) {
      console.error('Failed to send message:', err)
    } finally {
      setSending(false)
      textareaRef.current?.focus()
    }
  }, [content, sending, isOneTime, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (mentionQuery !== null && mentionList.length > 0) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx(i => (i + 1) % mentionList.length); return }
        if (e.key === 'ArrowUp')   { e.preventDefault(); setMentionIdx(i => (i - 1 + mentionList.length) % mentionList.length); return }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault()
          insertMention(mentionList[mentionIdx].username)
          return
        }
        if (e.key === 'Escape') { setMentionQuery(null); return }
      }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() }
    },
    [mentionQuery, mentionList, mentionIdx, insertMention, handleSend]
  )

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val    = e.target.value
    const cursor = e.target.selectionStart ?? val.length
    setContent(val)

    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`

    const ctx = getMentionContext(val, cursor)
    if (ctx) { setMentionQuery(ctx.query); setMentionStart(ctx.triggerStart) }
    else { setMentionQuery(null) }

    onTyping?.()
  }, [onTyping])

  function resetHeight() {
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  // File selected → show preview instead of uploading immediately
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingFile(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  // Called from AttachmentPreview once the user confirms
  const handleFileSend = useCallback(
    async (caption: string, isRestricted: boolean) => {
      if (!pendingFile) return
      const fileToSend = pendingFile
      setPendingFile(null)
      setUploading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const ext  = fileToSend.name.split('.').pop()
        const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { data: upload, error: uploadErr } = await supabase.storage
          .from('attachments').upload(path, fileToSend)
        if (uploadErr || !upload) { console.error('Upload error:', uploadErr); return }
        const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(upload.path)
        const attachment = {
          name: fileToSend.name, url: publicUrl,
          mime_type: fileToSend.type, size_bytes: fileToSend.size,
        }
        await onSend(caption.trim() || fileToSend.name, [attachment], isOneTime, undefined, isRestricted)
        if (content.trim()) setContent('')
        setIsOneTime(false)
      } catch (err) {
        console.error('Failed to send file:', err)
      } finally {
        setUploading(false)
      }
    },
    [supabase, pendingFile, content, isOneTime, onSend]
  )

  const handlePollSubmit = useCallback(
    async (question: string, options: string[], allowsMultiple: boolean, isAnonymous: boolean) => {
      setPollOpen(false)
      await onPoll(question, options, allowsMultiple, isAnonymous)
    },
    [onPoll]
  )

  const isEmpty = content.trim().length === 0

  return (
    <div className="p-4 pb-3">
      {pendingFile && (
        <AttachmentPreview
          file={pendingFile}
          onSend={(caption, isRestricted) => void handleFileSend(caption, isRestricted)}
          onCancel={() => setPendingFile(null)}
        />
      )}

      {pollOpen && (
        <PollCreator
          onSubmit={(q, opts, multi, anon) => void handlePollSubmit(q, opts, multi, anon)}
          onCancel={() => setPollOpen(false)}
        />
      )}

      {isOneTime && (
        <div className="flex items-center gap-1.5 mb-2 ml-1">
          <Flame size={12} className="text-orange-500" />
          <span className="text-xs text-orange-600 font-medium">
            One-time message — disappears after recipient views it
          </span>
          <button onClick={() => setIsOneTime(false)} className="text-xs text-ink-4 hover:text-ink ml-1 underline">
            Cancel
          </button>
        </div>
      )}

      {/* Mention dropdown */}
      {mentionQuery !== null && mentionList.length > 0 && (
        <div className="mb-1 bg-white border border-surface-3 rounded-xl shadow-lg overflow-hidden animate-fade-in">
          {mentionList.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => insertMention(m.username)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors',
                i === mentionIdx ? 'bg-brand-faint' : 'hover:bg-surface'
              )}
            >
              <Avatar src={m.avatar_url} username={m.username} size="xs" />
              <span className="text-sm font-medium text-ink">{m.full_name ?? m.username}</span>
              <span className="text-xs text-ink-4">@{m.username}</span>
            </button>
          ))}
          <p className="px-3 py-1.5 text-[10px] text-ink-4 border-t border-surface-2">
            ↑↓ navigate · Enter/Tab to pick · Esc to dismiss
          </p>
        </div>
      )}

      <div className={cn(
        'relative flex items-end gap-2 rounded-xl border bg-white px-3 py-2 transition-all',
        isOneTime
          ? 'border-orange-300 ring-2 ring-orange-200'
          : 'border-surface-3 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20'
      )}>
        {/* Attach */}
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
          className="flex-shrink-0 p-1 rounded-md text-ink-4 hover:text-brand-dark hover:bg-surface transition-colors disabled:opacity-50"
          title="Attach file">
          <Paperclip size={18} />
        </button>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />

        {/* Poll */}
        <button type="button" onClick={() => setPollOpen(true)}
          className="flex-shrink-0 p-1 rounded-md text-ink-4 hover:text-brand-dark hover:bg-surface transition-colors"
          title="Create poll">
          <BarChart2 size={18} />
        </button>

        {/* Textarea */}
        <textarea ref={textareaRef} value={content} onChange={handleInput} onKeyDown={handleKeyDown}
          placeholder={uploading ? 'Uploading…' : placeholder}
          disabled={uploading} rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-ink placeholder:text-ink-4
                     focus:outline-none leading-relaxed py-1 max-h-48 overflow-y-auto" />

        {/* Emoji picker */}
        <div className="relative flex-shrink-0">
          <button type="button" onClick={() => setPickerOpen(v => !v)} title="Emoji"
            className={cn('p-1.5 rounded-md transition-colors',
              pickerOpen ? 'text-brand bg-brand-faint' : 'text-ink-4 hover:text-brand hover:bg-surface')}>
            <Smile size={18} />
          </button>
          {pickerOpen && (
            <EmojiPickerPopover onSelect={insertEmoji} onClose={() => setPickerOpen(false)}
              className="bottom-full right-0 mb-2" />
          )}
        </div>

        {/* One-time toggle */}
        <button type="button" onClick={() => setIsOneTime(v => !v)}
          title={isOneTime ? 'Cancel one-time mode' : 'Send as one-time message'}
          className={cn('flex-shrink-0 p-1.5 rounded-md transition-colors',
            isOneTime ? 'text-orange-500 bg-orange-50 hover:bg-orange-100' : 'text-ink-4 hover:text-orange-400 hover:bg-surface')}>
          <Flame size={16} />
        </button>

        {/* Send */}
        <button type="button" onClick={() => void handleSend()}
          disabled={isEmpty || sending || uploading}
          className={cn('flex-shrink-0 p-1.5 rounded-md transition-colors',
            isEmpty || sending ? 'text-ink-4 cursor-not-allowed' : 'text-brand-dark hover:bg-brand-faint')}
          title="Send (Enter)">
          <SendHorizonal size={18} />
        </button>
      </div>

      <p className="text-[11px] text-ink-4 mt-1.5 ml-1">
        Enter to send · Shift+Enter for new line · @ to mention
      </p>
    </div>
  )
}
