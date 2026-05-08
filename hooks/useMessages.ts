'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/components/providers/AuthProvider'
import type { Message, MessageReaction } from '@/types'

interface UseMessagesOptions {
  channelId?: string
  conversationId?: string
  workspaceId: string
  limit?: number
}

interface UseMessagesReturn {
  messages:           Message[]
  pinnedMessages:     Message[]
  loading:            boolean
  hasMore:            boolean
  loadMore:           () => Promise<void>
  sendMessage:        (content: string, attachments?: any[], isOneTime?: boolean, pollId?: string, isRestricted?: boolean) => Promise<void>
  sendPoll:           (question: string, options: string[], allowsMultiple: boolean, isAnonymous: boolean) => Promise<void>
  editMessage:        (id: string, content: string) => Promise<void>
  deleteMessage:      (id: string) => Promise<void>
  pinMessage:         (id: string, isPinned: boolean) => Promise<void>
  toggleReaction:     (messageId: string, emoji: string) => Promise<void>
  markOneTimeViewed:  (messageId: string) => Promise<void>
}

export function useMessages({
  channelId,
  conversationId,
  workspaceId,
  limit = 50,
}: UseMessagesOptions): UseMessagesReturn {
  // createClient() is a singleton — useMemo is harmless but no longer needed
  const supabase = createClient()
  const { profile } = useAuth()

  // Hard ceiling on retained messages. Without this the array grows unbounded:
  // every loadMore() prepends 50 rows and every realtime INSERT appends one,
  // holding full joined objects (sender, attachments, reactions, poll) in RAM
  // forever. 200 gives ~4 pages of history with negligible memory footprint.
  const MAX_MESSAGES = 200

  const [messages, setMessages] = useState<Message[]>([])
  const [loading,  setLoading]  = useState(true)
  const [hasMore,  setHasMore]  = useState(false)
  const oldestRef   = useRef<string | null>(null)
  const mountIdRef  = useRef(crypto.randomUUID())

  // Track IDs we've already handled locally to avoid Realtime duplication
  const handledIdsRef = useRef<Set<string>>(new Set())

  const buildQuery = useCallback(
    (select: string, before?: string) => {
      let q = supabase
        .from('messages')
        .select(select)
        .eq('workspace_id', workspaceId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(limit + 1)

      if (channelId)      q = q.eq('channel_id', channelId)
      if (conversationId) q = q.eq('conversation_id', conversationId)
      if (before)         q = q.lt('created_at', before)

      return q
    },
    [supabase, workspaceId, channelId, conversationId, limit]
  )

  // Full select (requires migration 0006); falls back to base select if polls table missing
  const SELECT_FULL = `
    *,
    sender:profiles!sender_id(id, username, full_name, avatar_url, status),
    attachments(*),
    reactions:message_reactions(*),
    poll:polls!poll_id(id, question, allows_multiple, is_anonymous, created_by, ends_at, created_at, poll_options!poll_id(id, text, position))
  `
  const SELECT_BASE = `
    *,
    sender:profiles!sender_id(id, username, full_name, avatar_url, status),
    attachments(*),
    reactions:message_reactions(*)
  `

  // Mark the current channel/DM as read
  const markAsRead = useCallback(async () => {
    const now = new Date().toISOString()
    if (channelId) {
      await supabase
        .from('channel_members')
        .update({ last_read_at: now } as any)
        .eq('channel_id', channelId)
        .eq('user_id', profile?.id ?? '')
    } else if (conversationId) {
      await supabase
        .from('dm_members')
        .update({ last_read_at: now } as any)
        .eq('conversation_id', conversationId)
        .eq('user_id', profile?.id ?? '')
    }
  }, [supabase, channelId, conversationId, profile?.id])

  const load = useCallback(async () => {
    setLoading(true)
    // Try full query (with polls); fall back to base if polls table not yet migrated
    let { data, error } = await buildQuery(SELECT_FULL)
    if (error) {
      const fallback = await buildQuery(SELECT_BASE)
      data  = fallback.data
      error = fallback.error
    }
    if (error) {
      console.error('Error loading messages:', error)
      setLoading(false)
      return
    }
    if (!data) { setLoading(false); return }

    const hasMoreRows = data.length > limit
    const rows = (hasMoreRows ? data.slice(0, limit) : data).reverse() as unknown as Message[]

    setHasMore(hasMoreRows)
    setMessages(rows)
    if (rows.length > 0) oldestRef.current = rows[0].created_at
    setLoading(false)

    void markAsRead()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildQuery, limit, markAsRead])

  const loadMore = useCallback(async () => {
    if (!oldestRef.current) return
    let { data, error } = await buildQuery(SELECT_FULL, oldestRef.current)
    if (error) {
      const fallback = await buildQuery(SELECT_BASE, oldestRef.current)
      data  = fallback.data
      error = fallback.error
    }
    if (error) {
      console.error('Error loading more messages:', error)
      return
    }
    if (!data) return

    const hasMoreRows = data.length > limit
    const rows = (hasMoreRows ? data.slice(0, limit) : data).reverse() as unknown as Message[]

    setHasMore(hasMoreRows)
    setMessages(prev => {
      const combined = [...rows, ...prev]
      // Trim from the end (newest end) to stay within ceiling when loading history
      return combined.length > MAX_MESSAGES ? combined.slice(0, MAX_MESSAGES) : combined
    })
    if (rows.length > 0) oldestRef.current = rows[0].created_at
  }, [buildQuery, limit])

  useEffect(() => {
    if (!channelId && !conversationId) return
    void load()
  }, [load, channelId, conversationId])

  // Keep markAsRead stable so the realtime sub never re-creates
  const markAsReadRef = useRef(markAsRead)
  useEffect(() => { markAsReadRef.current = markAsRead }, [markAsRead])

  // ── Realtime: messages + reactions ─────────────────────────────────────────
  useEffect(() => {
    if (!channelId && !conversationId) return

    const channel = supabase
      // Deterministic name — the singleton client deduplicates by name so we
      // never open two subscriptions for the same conversation. The old UUID
      // suffix prevented that deduplication, leaving orphaned server slots on
      // every channel navigation.
      .channel(`messages:${channelId ?? conversationId}-${mountIdRef.current}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        async (payload) => {
          const newRow = payload.new as any
          const oldRow = payload.old as any
          const row    = payload.eventType === 'DELETE' ? oldRow : newRow
          if (!row) return

          const isRelevant = channelId
            ? row.channel_id === channelId
            : row.conversation_id === conversationId
          if (!isRelevant) return

          if (payload.eventType === 'INSERT') {
            if (handledIdsRef.current.has(row.id)) return

            let { data } = await supabase
              .from('messages')
              .select(`*, sender:profiles!sender_id(*), attachments(*), reactions:message_reactions(*), poll:polls!poll_id(id, question, allows_multiple, is_anonymous, created_by, ends_at, created_at, poll_options!poll_id(id, text, position))`)
              .eq('id', row.id)
              .single()

            // Fallback if polls table doesn't exist yet
            if (!data) {
              const fb = await supabase
                .from('messages')
                .select(`*, sender:profiles!sender_id(*), attachments(*), reactions:message_reactions(*)`)
                .eq('id', row.id)
                .single()
              data = fb.data
            }

            if (data) {
              setMessages(prev => {
                if (prev.some(m => m.id === data!.id)) return prev
                const next = [...prev, data as Message]
                // Trim oldest messages from the front to stay within ceiling
                return next.length > MAX_MESSAGES ? next.slice(next.length - MAX_MESSAGES) : next
              })
              void markAsReadRef.current()
            }
          } else if (payload.eventType === 'UPDATE') {
            setMessages(prev =>
              prev.map(m => m.id === newRow.id ? { ...m, ...newRow } as Message : m)
            )
          } else if (payload.eventType === 'DELETE') {
            setMessages(prev => prev.filter(m => m.id !== oldRow.id))
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_reactions' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const r = payload.new as MessageReaction
            setMessages(prev => prev.map(m =>
              m.id === r.message_id
                ? { ...m, reactions: (m.reactions ?? []).some(x => x.id === r.id)
                    ? m.reactions
                    : [...(m.reactions ?? []), r]
                  }
                : m
            ))
          } else if (payload.eventType === 'DELETE') {
            const r = payload.old as MessageReaction
            setMessages(prev => prev.map(m =>
              m.id === r.message_id
                ? { ...m, reactions: (m.reactions ?? []).filter(x => x.id !== r.id) }
                : m
            ))
          }
        }
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  // markAsRead intentionally excluded — using ref above
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, channelId, conversationId])

  // ── sendMessage ─────────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (content: string, attachments?: any[], isOneTime = false, pollId?: string, isRestricted = false, optimisticPoll?: any) => {
      const trimmed = content.trim()
      if (!trimmed && (!attachments || attachments.length === 0)) return
      if (!profile) {
        console.error('Cannot send message: profile not loaded')
        return
      }

      const tempId = crypto.randomUUID()
      const optimisticMsg: Message = {
        id: tempId,
        workspace_id: workspaceId,
        channel_id: channelId ?? null,
        conversation_id: conversationId ?? null,
        sender_id: profile.id,
        content: trimmed,
        created_at: new Date().toISOString(),
        is_deleted: false,
        is_pinned: false,
        pinned_by: null,
        pinned_at: null,
        edited_at: null,
        thread_parent_id: null,
        is_one_time: isOneTime,
        viewed_by: [],
        is_restricted: isRestricted,
        poll_id: pollId ?? null,
        sender: profile as any,
        attachments: attachments || [],
        reactions: [],
        poll: optimisticPoll ?? null,
      }

      setMessages(prev => [...prev, optimisticMsg])

      const { data: realMsg, error } = await supabase
        .from('messages')
        .insert({
          workspace_id:    workspaceId,
          channel_id:      channelId      ?? null,
          conversation_id: conversationId ?? null,
          sender_id:       profile.id,
          content:         trimmed,
          is_one_time:     isOneTime,
          is_restricted:   isRestricted,
          poll_id:         pollId ?? null,
        })
        .select()
        .single()

      if (error || !realMsg) {
        console.error('Error inserting message:', error)
        setMessages(prev => prev.filter(m => m.id !== tempId))
        throw error || new Error('Failed to insert message')
      }

      handledIdsRef.current.add(realMsg.id)

      if (attachments && attachments.length > 0) {
        const attachmentRows = attachments.map(att => ({ message_id: realMsg.id, ...att }))
        const { error: attError } = await supabase.from('attachments').insert(attachmentRows)
        if (attError) console.error('Error inserting attachments:', attError)
      }

      setMessages(prev => prev.map(m =>
        m.id === tempId ? { ...m, id: realMsg.id, created_at: realMsg.created_at } as Message : m
      ))

      // No need to store/clear this timer — the Set entry is ephemeral and
      // the closure is tiny. If the component unmounts before 10s the timer
      // still fires but mutating a ref on an unmounted component is safe.
      setTimeout(() => handledIdsRef.current.delete(realMsg.id), 10_000)
    },
    [supabase, workspaceId, channelId, conversationId, profile]
  )

  // ── sendPoll ────────────────────────────────────────────────────────────────
  const sendPoll = useCallback(
    async (question: string, options: string[], allowsMultiple: boolean, isAnonymous: boolean) => {
      if (!profile) return

      // Create poll
      const { data: poll, error: pollErr } = await supabase
        .from('polls')
        .insert({
          workspace_id: workspaceId,
          question,
          allows_multiple: allowsMultiple,
          is_anonymous: isAnonymous,
          created_by: profile.id,
        })
        .select()
        .single()

      if (pollErr || !poll) { console.error('Error creating poll:', pollErr); return }

      // Create options
      const optionRows = options.map((text, i) => ({ poll_id: poll.id, text, position: i }))
      const { error: optErr } = await supabase.from('poll_options').insert(optionRows)
      if (optErr) console.error('Error creating poll options:', optErr)

      // Build an optimistic poll object so the UI renders immediately without a flicker
      const optimisticPoll = {
        id:              poll.id,
        question,
        allows_multiple: allowsMultiple,
        is_anonymous:    isAnonymous,
        created_by:      profile.id,
        ends_at:         null,
        created_at:      poll.created_at,
        poll_options:    options.map((text, i) => ({
          id:       crypto.randomUUID(),
          text,
          position: i,
        })),
      }

      // Send message — optimistic entry already has full poll data, renders correctly at once
      await sendMessage('📊 Poll', undefined, false, poll.id, false, optimisticPoll)

      // Fetch the real message with DB-assigned option IDs and replace optimistic entry
      const { data: fullMsg } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!sender_id(id, username, full_name, avatar_url, status),
          attachments(*),
          reactions:message_reactions(*),
          poll:polls!poll_id(id, question, allows_multiple, is_anonymous, created_by, ends_at, created_at,
            poll_options!poll_id(id, text, position))
        `)
        .eq('poll_id', poll.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (fullMsg) {
        setMessages(prev =>
          prev.map(m => (m as any).poll_id === poll.id ? fullMsg as unknown as Message : m)
        )
      }
    },
    [supabase, workspaceId, profile, sendMessage]
  )

  // ── editMessage ─────────────────────────────────────────────────────────────
  const editMessage = useCallback(
    async (id: string, content: string) => {
      const { error } = await supabase
        .from('messages')
        .update({ content, edited_at: new Date().toISOString() })
        .eq('id', id)
      if (error) console.error('Error editing message:', error)
    },
    [supabase]
  )

  // ── deleteMessage ───────────────────────────────────────────────────────────
  const deleteMessage = useCallback(
    async (id: string) => {
      // Optimistic — show tombstone immediately
      setMessages(prev => prev.map(m => m.id === id ? { ...m, is_deleted: true } : m))
      const { error } = await supabase
        .from('messages')
        .update({ is_deleted: true })
        .eq('id', id)
      if (error) {
        console.error('Error deleting message:', error)
        // Revert on failure
        setMessages(prev => prev.map(m => m.id === id ? { ...m, is_deleted: false } : m))
      }
    },
    [supabase]
  )

  // ── pinMessage ──────────────────────────────────────────────────────────────
  const pinMessage = useCallback(
    async (id: string, isPinned: boolean) => {
      setMessages(prev => prev.map(m =>
        m.id === id
          ? { ...m, is_pinned: isPinned,
              pinned_by: isPinned ? (profile?.id ?? null) : null,
              pinned_at: isPinned ? new Date().toISOString() : null }
          : m
      ))
      const { error } = await supabase
        .from('messages')
        .update({
          is_pinned: isPinned,
          pinned_by: isPinned ? (profile?.id ?? null) : null,
          pinned_at: isPinned ? new Date().toISOString() : null,
        } as any)
        .eq('id', id)
      if (error) {
        console.error('Error pinning message:', error)
        setMessages(prev => prev.map(m => m.id === id ? { ...m, is_pinned: !isPinned } : m))
      }
    },
    [supabase, profile?.id]
  )

  // ── toggleReaction ──────────────────────────────────────────────────────────
  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!profile) return

      const msg      = messages.find(m => m.id === messageId)
      const existing = (msg?.reactions ?? []).find(r => r.user_id === profile.id && r.emoji === emoji)

      if (existing) {
        setMessages(prev => prev.map(m =>
          m.id === messageId
            ? { ...m, reactions: (m.reactions ?? []).filter(r => r.id !== existing.id) }
            : m
        ))
        const { error } = await supabase.from('message_reactions').delete().eq('id', existing.id)
        if (error) {
          console.error('Error removing reaction:', error)
          setMessages(prev => prev.map(m =>
            m.id === messageId
              ? { ...m, reactions: [...(m.reactions ?? []), existing] }
              : m
          ))
        }
      } else {
        const tempReaction: MessageReaction = {
          id: crypto.randomUUID(),
          message_id: messageId,
          user_id: profile.id,
          emoji,
          created_at: new Date().toISOString(),
        }
        setMessages(prev => prev.map(m =>
          m.id === messageId
            ? { ...m, reactions: [...(m.reactions ?? []), tempReaction] }
            : m
        ))
        const { data, error } = await supabase
          .from('message_reactions')
          .insert({ message_id: messageId, user_id: profile.id, emoji })
          .select()
          .single()
        if (error) {
          console.error('Error adding reaction:', error)
          setMessages(prev => prev.map(m =>
            m.id === messageId
              ? { ...m, reactions: (m.reactions ?? []).filter(r => r.id !== tempReaction.id) }
              : m
          ))
        } else if (data) {
          setMessages(prev => prev.map(m =>
            m.id === messageId
              ? { ...m, reactions: (m.reactions ?? []).map(r => r.id === tempReaction.id ? data as MessageReaction : r) }
              : m
          ))
        }
      }
    },
    [supabase, profile, messages]
  )

  // ── markOneTimeViewed ───────────────────────────────────────────────────────
  const markOneTimeViewed = useCallback(
    async (messageId: string) => {
      if (!profile) return
      setMessages(prev => prev.map(m =>
        m.id === messageId
          ? { ...m, viewed_by: [...(m.viewed_by ?? []), profile.id] }
          : m
      ))
      const { error } = await supabase.rpc('mark_one_time_viewed', { p_message_id: messageId })
      if (error) {
        console.error('Error marking one-time viewed:', error)
        setMessages(prev => prev.map(m =>
          m.id === messageId
            ? { ...m, viewed_by: (m.viewed_by ?? []).filter(id => id !== profile.id) }
            : m
        ))
      }
    },
    [supabase, profile]
  )

  const pinnedMessages = useMemo(
    () => messages.filter(m => m.is_pinned && !m.is_deleted),
    [messages]
  )

  return {
    messages, pinnedMessages, loading, hasMore, loadMore,
    sendMessage, sendPoll, editMessage, deleteMessage, pinMessage,
    toggleReaction, markOneTimeViewed,
  }
}
