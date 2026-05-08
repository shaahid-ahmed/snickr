'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Notification } from '@/types'

export function useNotifications(workspaceId: string, userId: string) {
  
  const supabase = createClient()

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount,   setUnreadCount]   = useState(0)
  const [loading,       setLoading]       = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select(`
        *,
        from_user:profiles!from_user_id(id, username, full_name, avatar_url),
        channel:channels(id, name)
      `)
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (data) {
      setNotifications(data as Notification[])
      setUnreadCount(data.filter(n => !n.is_read).length)
    }
    setLoading(false)
  }, [supabase, workspaceId, userId])

  useEffect(() => { void load() }, [load])

  // Realtime: new notifications arrive instantly
  useEffect(() => {
    const ch = supabase
      .channel(`notifs:${userId}:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          // Fetch the full row with joins
          const { data } = await supabase
            .from('notifications')
            .select(`*, from_user:profiles!from_user_id(id, username, full_name, avatar_url), channel:channels(id, name)`)
            .eq('id', (payload.new as any).id)
            .single()
          if (data) {
            setNotifications(prev => [data as Notification, ...prev])
            setUnreadCount(c => c + 1)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as Notification
          setNotifications(prev => prev.map(n => n.id === updated.id ? { ...n, ...updated } : n))
          setUnreadCount(prev => Math.max(0, prev + (updated.is_read ? -1 : 0)))
        }
      )
      .subscribe()

    return () => { void supabase.removeChannel(ch) }
  }, [supabase, userId, workspaceId])

  const markRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    setUnreadCount(c => Math.max(0, c - 1))
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
  }, [supabase])

  const markAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .eq('is_read', false)
  }, [supabase, userId, workspaceId])

  return { notifications, unreadCount, loading, markRead, markAllRead }
}
