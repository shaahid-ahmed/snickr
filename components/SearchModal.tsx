'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { Avatar } from '@/components/Avatar'
import { formatTime } from '@/lib/utils'
import type { Message } from '@/types'

interface SearchResult extends Omit<Message, 'conversation_id'> {
  channel_name?: string | null
  conversation_id: string | null
}

interface SearchModalProps {
  isOpen:       boolean
  workspaceId:  string
  onClose:      () => void
  onNavigate:   (channelId?: string, conversationId?: string) => void
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="bg-yellow-200 text-ink rounded-sm px-0.5">{part}</mark>
      : part
  )
}

export function SearchModal({ isOpen, workspaceId, onClose, onNavigate }: SearchModalProps) {
  
  const supabase = createClient()

  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef  = useRef<HTMLInputElement>(null)
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setResults([])
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:profiles!sender_id(id, username, full_name, avatar_url, status),
        channel:channels!channel_id(name)
      `)
      .eq('workspace_id', workspaceId)
      .eq('is_deleted', false)
      .ilike('content', `%${q}%`)
      .order('created_at', { ascending: false })
      .limit(30)

    setLoading(false)
    if (error) { console.error('Search error:', error); return }

    setResults((data ?? []).map((r: any) => ({
      ...r,
      channel_name: r.channel?.name ?? null,
    })) as SearchResult[])
  }, [supabase, workspaceId])

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => void doSearch(val), 300)
  }, [doSearch])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '70vh' }}>

        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search size={18} className="text-ink-4 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInput}
            placeholder="Search messages…"
            className="flex-1 text-sm text-ink bg-transparent focus:outline-none placeholder:text-ink-4"
          />
          {loading && (
            <span className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin flex-shrink-0" />
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-md text-ink-4 hover:text-ink hover:bg-surface transition-colors flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {!query.trim() && (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-ink-4">
              <Search size={28} className="opacity-40" />
              <p className="text-sm">Type to search messages…</p>
            </div>
          )}

          {query.trim() && !loading && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-ink-4">
              <Search size={28} className="opacity-40" />
              <p className="text-sm">No results for &ldquo;{query}&rdquo;</p>
            </div>
          )}

          {results.length > 0 && (
            <ul className="py-2">
              {results.map(result => {
                const sender = result.sender
                const displayName = sender?.full_name ?? sender?.username ?? 'Unknown'
                return (
                  <li key={result.id}>
                    <button
                      className="w-full text-left px-4 py-3 hover:bg-surface transition-colors flex gap-3 items-start"
                      onClick={() => {
                        onNavigate(result.channel_id ?? undefined, result.conversation_id ?? undefined)
                        onClose()
                      }}
                    >
                      <Avatar
                        src={sender?.avatar_url ?? null}
                        username={sender?.username ?? '?'}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className="text-sm font-medium text-ink">{displayName}</span>
                          <span className="text-xs text-ink-4">{formatTime(result.created_at)}</span>
                          {result.channel_name && (
                            <span className="text-xs text-ink-4 ml-auto">#{result.channel_name}</span>
                          )}
                          {!result.channel_name && result.conversation_id && (
                            <span className="text-xs text-ink-4 ml-auto">DM</span>
                          )}
                        </div>
                        <p className="text-sm text-ink-2 leading-relaxed line-clamp-2">
                          {highlight(result.content, query)}
                        </p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-4 text-[11px] text-ink-4">
          <span><kbd className="px-1 py-0.5 bg-surface rounded text-[10px]">↵</kbd> to open</span>
          <span><kbd className="px-1 py-0.5 bg-surface rounded text-[10px]">Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  )
}
