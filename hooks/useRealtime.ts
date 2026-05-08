'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'

interface UseRealtimeChannelsOptions {
  workspaceId: string
  userId: string
  onChannelChange: () => void
}

/** Subscribes to channel/membership changes for the sidebar. */
export function useRealtimeChannels({
  workspaceId,
  userId,
  onChannelChange,
}: UseRealtimeChannelsOptions) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const supabase = createClient()
  const mountIdRef = useRef(crypto.randomUUID())

  useEffect(() => {
    const sub = supabase
      .channel(`workspace-channels:${workspaceId}-${mountIdRef.current}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channels',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        onChannelChange
      )
      // ⚠️ Only INSERT/DELETE — NOT UPDATE.
      // UPDATE fires on every last_read_at change (i.e., every message read),
      // which would trigger a full fetchAll() on every incoming message.
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'channel_members',
          filter: `user_id=eq.${userId}`,
        },
        onChannelChange
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'channel_members',
          filter: `user_id=eq.${userId}`,
        },
        onChannelChange
      )
      .subscribe()

    return () => { void supabase.removeChannel(sub) }
  }, [supabase, workspaceId, userId, onChannelChange])
}

interface UseRealtimePresenceOptions {
  workspaceId: string
  userId: string
  onPresenceChange?: (userId: string, online: boolean) => void
}

/** Tracks online presence for workspace members. */
export function useRealtimePresence({
  workspaceId,
  userId,
}: UseRealtimePresenceOptions) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const supabase = createClient()
  const mountIdRef = useRef(crypto.randomUUID())

  useEffect(() => {
    const channel = supabase.channel(`presence:${workspaceId}-${mountIdRef.current}`, {
      config: { presence: { key: userId } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {})
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: userId, online_at: new Date().toISOString() })
        }
      })

    return () => { void supabase.removeChannel(channel) }
  }, [supabase, workspaceId, userId])
}
