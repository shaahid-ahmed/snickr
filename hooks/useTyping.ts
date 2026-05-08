'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'

const STOP_DELAY_MS = 2500

export interface TypingUser {
  userId:   string
  username: string
}

/**
 * Supabase Presence-based typing indicator.
 *
 * @param roomKey       e.g. `channel:${channelId}` or `dm:${conversationId}`
 * @param currentUserId The signed-in user's id (excluded from the list)
 * @param currentUsername The signed-in user's username (broadcast to others)
 */
export function useTyping(
  roomKey:         string,
  currentUserId:   string,
  currentUsername: string,
) {
  
  const supabase = createClient()
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([])
  const stopTimerRef  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const channelRef    = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const isTypingRef   = useRef(false)
  const mountIdRef    = useRef(crypto.randomUUID())

  useEffect(() => {
    if (!roomKey || !currentUserId) return

    const ch = supabase.channel(`typing:${roomKey}-${mountIdRef.current}`, {
      config: { presence: { key: currentUserId } },
    })

    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState<{ username: string; typing: boolean }>()
      const list: TypingUser[] = []
      for (const [userId, presences] of Object.entries(state)) {
        if (userId !== currentUserId && presences[0]?.typing) {
          list.push({ userId, username: presences[0].username })
        }
      }
      setTypingUsers(list)
    })

    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await ch.track({ username: currentUsername, typing: false })
      }
    })

    channelRef.current = ch
    return () => {
      clearTimeout(stopTimerRef.current)
      void supabase.removeChannel(ch)
    }
  }, [supabase, roomKey, currentUserId, currentUsername])

  /** Call on every keystroke in the input */
  const notifyTyping = useCallback(async () => {
    clearTimeout(stopTimerRef.current)
    if (!isTypingRef.current) {
      isTypingRef.current = true
      await channelRef.current?.track({ username: currentUsername, typing: true })
    }
    stopTimerRef.current = setTimeout(async () => {
      isTypingRef.current = false
      await channelRef.current?.track({ username: currentUsername, typing: false })
    }, STOP_DELAY_MS)
  }, [currentUsername])

  /** Call when the input is cleared / message sent */
  const clearTyping = useCallback(async () => {
    clearTimeout(stopTimerRef.current)
    isTypingRef.current = false
    await channelRef.current?.track({ username: currentUsername, typing: false })
  }, [currentUsername])

  return { typingUsers, notifyTyping, clearTyping }
}
