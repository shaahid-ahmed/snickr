'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Channel, ChannelRole, DmConversation, Profile, Workspace, WorkspaceMember, WorkspaceRole, WorkspaceInvite } from '@/types'

interface DmWithMembers extends DmConversation {
  members: Profile[]
  is_starred: boolean
}

interface UseWorkspaceReturn {
  workspace: Workspace | null
  channels:  Channel[]
  dms:       DmWithMembers[]
  members:   WorkspaceMember[]
  loading:   boolean
  refresh:   () => Promise<void>
  fetchUnreadCounts: () => Promise<void>
  createChannel: (name: string, isPrivate?: boolean) => Promise<Channel | null>
  createDm:      (targetUserId: string) => Promise<DmConversation | null>
  removeChannelMember: (channelId: string, targetUserId: string) => Promise<void>
  updateChannelRole: (channelId: string, targetUserId: string, role: ChannelRole) => Promise<void>
  addChannelMember: (channelId: string, targetUserId: string) => Promise<void>
  // Workspace management
  updateWorkspaceMemberRole: (targetUserId: string, role: WorkspaceRole) => Promise<void>
  removeWorkspaceMember: (targetUserId: string) => Promise<void>
  createInvite: (expiresInDays?: number) => Promise<WorkspaceInvite | null>
  getInvites: () => Promise<WorkspaceInvite[]>
  // New feature actions
  pinChannel:      (channelId: string, isPinned: boolean) => Promise<void>
  starChannel:     (channelId: string, isStarred: boolean) => Promise<void>
  starDm:          (conversationId: string, isStarred: boolean) => Promise<void>
  markChannelRead: (channelId: string) => Promise<void>
  markDmRead:      (conversationId: string) => Promise<void>
  fetchArchivedChannels: () => Promise<import('@/types').Channel[]>
  unarchiveChannel: (channelId: string) => Promise<void>
}

export function useWorkspace(
  workspaceId: string,
  userId: string
): UseWorkspaceReturn {
  
  const supabase = createClient()

  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [channels,  setChannels]  = useState<Channel[]>([])
  const [dms,       setDms]       = useState<DmWithMembers[]>([])
  const [members,   setMembers]   = useState<WorkspaceMember[]>([])
  const [loading,   setLoading]   = useState(true)

  // Unique ID per component mount — appended to Realtime channel names so that
  // cleanup (removeChannel, async) and immediate re-mount never collide on the
  // same channel name while it is still in "subscribed" state on the singleton client.
  const mountIdRef = useRef(crypto.randomUUID())

  // Prevents concurrent fetchAll calls from piling up (e.g. multiple
  // rapid realtime events all triggering a refresh simultaneously)
  const isFetchingRef  = useRef(false)
  const isInitialRef   = useRef(true)

  // ─── Fetch unread counts only (lightweight refresh) ────────────────────────
  const fetchUnreadCounts = useCallback(async () => {
    const [chUnread, dmUnread] = await Promise.all([
      supabase.rpc('get_unread_counts', { p_user_id: userId, p_workspace_id: workspaceId }),
      supabase.rpc('get_dm_unread_counts', { p_user_id: userId, p_workspace_id: workspaceId }),
    ])

    if (chUnread.data) {
      const map = new Map<string, number>((chUnread.data as any[]).map((r: any) => [r.channel_id, Number(r.unread_count)]))
      setChannels(prev => prev.map(ch => ({ ...ch, unread_count: map.get(ch.id) ?? 0 })))
    }

    if (dmUnread.data) {
      const map = new Map<string, number>((dmUnread.data as any[]).map((r: any) => [r.conversation_id, Number(r.unread_count)]))
      setDms(prev => prev.map(dm => ({ ...dm, unread_count: map.get(dm.id) ?? 0 })))
    }
  }, [supabase, userId, workspaceId])

  const fetchAll = useCallback(async () => {
    // Drop the call if one is already in-flight
    if (isFetchingRef.current) return
    isFetchingRef.current = true

    // Only show the loading skeleton on the very first fetch —
    // background refreshes (triggered by realtime events) update
    // state silently so the UI doesn't flash.
    const isInitial = isInitialRef.current
    if (isInitial) setLoading(true)

    try {

    // Run all independent queries in parallel
    const [wsRes, memRes, chRes, dmMembershipsRes] = await Promise.all([
      supabase.from('workspaces').select('*').eq('id', workspaceId).single(),
      supabase.from('workspace_members').select('*, profile:profiles(*)').eq('workspace_id', workspaceId),
      supabase
        .from('channels')
        .select('*, channel_members!inner(user_id, is_pinned, is_starred, last_read_at, role)')
        .eq('workspace_id', workspaceId)
        .eq('is_archived', false)
        .eq('channel_members.user_id', userId)
        .order('name'),
      supabase.from('dm_members').select('conversation_id, is_starred').eq('user_id', userId),
    ])

    if (wsRes.data)  setWorkspace(wsRes.data)
    if (memRes.data) setMembers(memRes.data as WorkspaceMember[])

    // Channels — cascading fallback for missing migration columns
    let chData = chRes.data
    if (chRes.error) {
      // Try without is_starred (migration 0005 might be missing)
      const fb1 = await supabase
        .from('channels')
        .select('*, channel_members!inner(user_id, is_pinned, last_read_at)')
        .eq('workspace_id', workspaceId)
        .eq('is_archived', false)
        .eq('channel_members.user_id', userId)
        .order('name')
      if (!fb1.error) {
        chData = fb1.data
      } else {
        // Try without is_archived too (migration 0006 not yet run)
        const fb2 = await supabase
          .from('channels')
          .select('*, channel_members!inner(user_id, is_pinned, last_read_at)')
          .eq('workspace_id', workspaceId)
          .eq('channel_members.user_id', userId)
          .order('name')
        chData = fb2.data
      }
    }

    // DM conversations
    const convIds = (dmMembershipsRes.data ?? []).map((m: any) => m.conversation_id as string)
    const dmStarMap = new Map<string, boolean>((dmMembershipsRes.data ?? []).map((m: any) => [m.conversation_id as string, !!(m.is_starred)]))

    // Fetch unread counts in parallel with DM conversations
    const [dmConvResult, chUnreadRes, dmUnreadRes] = await Promise.all([
      convIds.length > 0
        ? supabase
            .from('dm_conversations')
            .select(`id, workspace_id, created_at, dm_members(user_id, last_read_at, is_starred, profiles(id, username, full_name, avatar_url, status, is_dnd))`)
            .in('id', convIds)
            .eq('workspace_id', workspaceId)
        : Promise.resolve({ data: [] }),
      supabase.rpc('get_unread_counts', { p_user_id: userId, p_workspace_id: workspaceId }),
      supabase.rpc('get_dm_unread_counts', { p_user_id: userId, p_workspace_id: workspaceId }),
    ])

    // Build unread maps
    const chUnreadMap = new Map<string, number>()
    if (chUnreadRes.data) {
      for (const r of chUnreadRes.data as any[]) {
        chUnreadMap.set(r.channel_id, Number(r.unread_count))
      }
    }

    const dmUnreadMap = new Map<string, number>()
    if (dmUnreadRes.data) {
      for (const r of dmUnreadRes.data as any[]) {
        dmUnreadMap.set(r.conversation_id, Number(r.unread_count))
      }
    }

    if (chData) {
      setChannels(chData.map((ch: any) => {
        const m = ch.channel_members?.[0]
        return {
          ...ch,
          is_pinned:    m?.is_pinned  ?? false,
          is_starred:   m?.is_starred ?? false,
          last_read_at: m?.last_read_at ?? null,
          role:         m?.role ?? 'member',
          unread_count: chUnreadMap.get(ch.id) ?? 0,
          channel_members: undefined,
        }
      }))
    }

    if (dmConvResult.data) {
      setDms((dmConvResult.data as any[]).map((dc: any) => ({
        id:           dc.id,
        workspace_id: dc.workspace_id,
        created_at:   dc.created_at,
        is_starred:   dmStarMap.get(dc.id) ?? false,
        unread_count: dmUnreadMap.get(dc.id) ?? 0,
        members: (dc.dm_members as any[])
          .filter((m: any) => m.user_id !== userId)
          .map((m: any) => m.profiles)
          .filter(Boolean),
      })))
    }

    } finally {
      if (isInitial) setLoading(false)
      isInitialRef.current  = false
      isFetchingRef.current = false
    }
  }, [supabase, workspaceId, userId])

  useEffect(() => { void fetchAll() }, [fetchAll])

  // Live-update profile fields (status, is_dnd, full_name, avatar_url) for all visible members
  useEffect(() => {
    const ch = supabase
      .channel(`profiles-watch-${workspaceId}-${mountIdRef.current}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload) => {
          const updated = payload.new as import('@/types').Profile
          setMembers(prev => prev.map(m =>
            m.user_id === updated.id ? { ...m, profile: updated } : m
          ))
          setDms(prev => prev.map(dm => ({
            ...dm,
            members: dm.members.map(p => p.id === updated.id ? updated : p),
          })))
        }
      )
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [supabase, workspaceId])

  const createChannel = useCallback(
    async (name: string, isPrivate = false): Promise<Channel | null> => {
      const { data: ch, error: chErr } = await supabase
        .from('channels')
        .insert({ workspace_id: workspaceId, name, is_private: isPrivate, created_by: userId })
        .select()
        .single()

      if (chErr || !ch) return null

      const { error: memErr } = await supabase
        .from('channel_members')
        .insert({ channel_id: ch.id, user_id: userId, role: 'admin' })

      if (memErr && (memErr.message.includes('role') || memErr.code === '42703')) {
        await supabase
          .from('channel_members')
          .insert({ channel_id: ch.id, user_id: userId })
      }

      await fetchAll()
      return ch
    },
    [supabase, workspaceId, userId, fetchAll]
  )

  const createDm = useCallback(
    async (targetUserId: string): Promise<DmConversation | null> => {
      const existing = dms.find(dm =>
        dm.members.length === 1 && dm.members[0]?.id === targetUserId
      )
      if (existing) return existing

      const { data: conv, error } = await supabase
        .from('dm_conversations')
        .insert({ workspace_id: workspaceId })
        .select()
        .single()

      if (error || !conv) return null

      await supabase.from('dm_members').insert([
        { conversation_id: conv.id, user_id: userId },
        { conversation_id: conv.id, user_id: targetUserId },
      ])

      await fetchAll()
      return conv
    },
    [supabase, workspaceId, userId, dms, fetchAll]
  )

  const removeChannelMember = useCallback(
    async (channelId: string, targetUserId: string) => {
      await supabase.from('channel_members').delete().eq('channel_id', channelId).eq('user_id', targetUserId)
      await fetchAll()
    },
    [supabase, fetchAll]
  )

  const updateChannelRole = useCallback(
    async (channelId: string, targetUserId: string, role: ChannelRole) => {
      await supabase.from('channel_members').update({ role }).eq('channel_id', channelId).eq('user_id', targetUserId)
      await fetchAll()
    },
    [supabase, fetchAll]
  )

  const addChannelMember = useCallback(
    async (channelId: string, targetUserId: string) => {
      const { error } = await supabase
        .from('channel_members')
        .insert({ channel_id: channelId, user_id: targetUserId, role: 'member' })

      if (error && (error.message.includes('role') || error.code === '42703')) {
        await supabase
          .from('channel_members')
          .insert({ channel_id: channelId, user_id: targetUserId })
      }
      await fetchAll()
    },
    [supabase, fetchAll]
  )

  // ─── Workspace Management ──────────────────────────────────────────────────

  const updateWorkspaceMemberRole = useCallback(
    async (targetUserId: string, role: WorkspaceRole) => {
      const { error } = await supabase
        .from('workspace_members')
        .update({ role })
        .eq('workspace_id', workspaceId)
        .eq('user_id', targetUserId)
      if (error) console.error('Error updating workspace member role:', error)
      await fetchAll()
    },
    [supabase, workspaceId, fetchAll]
  )

  const removeWorkspaceMember = useCallback(
    async (targetUserId: string) => {
      const { error } = await supabase
        .from('workspace_members')
        .delete()
        .eq('workspace_id', workspaceId)
        .eq('user_id', targetUserId)
      if (error) console.error('Error removing workspace member:', error)
      await fetchAll()
    },
    [supabase, workspaceId, fetchAll]
  )

  const createInvite = useCallback(
    async (expiresInDays = 7) => {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + expiresInDays)

      const { data, error } = await supabase
        .from('workspace_invites')
        .insert({
          workspace_id: workspaceId,
          created_by: userId,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating invite:', JSON.stringify(error, null, 2))
        return null
      }
      return data as WorkspaceInvite
    },
    [supabase, workspaceId, userId]
  )

  const getInvites = useCallback(async () => {
    const { data, error } = await supabase
      .from('workspace_invites')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error getting invites:', JSON.stringify(error, null, 2))
      return []
    }
    return data as WorkspaceInvite[]
  }, [supabase, workspaceId])

  // ─── Pin / Star / Mark-read ────────────────────────────────────────────────

  const pinChannel = useCallback(
    async (channelId: string, isPinned: boolean) => {
      // Optimistic update
      setChannels(prev => prev.map(ch => ch.id === channelId ? { ...ch, is_pinned: isPinned } : ch))
      const { error } = await supabase
        .from('channel_members')
        .update({ is_pinned: isPinned } as any)
        .eq('channel_id', channelId)
        .eq('user_id', userId)
      if (error) {
        console.error('Error pinning channel:', error)
        // Revert on error
        setChannels(prev => prev.map(ch => ch.id === channelId ? { ...ch, is_pinned: !isPinned } : ch))
      }
    },
    [supabase, userId]
  )

  const starChannel = useCallback(
    async (channelId: string, isStarred: boolean) => {
      setChannels(prev => prev.map(ch => ch.id === channelId ? { ...ch, is_starred: isStarred } : ch))
      const { error } = await supabase
        .from('channel_members')
        .update({ is_starred: isStarred } as any)
        .eq('channel_id', channelId)
        .eq('user_id', userId)
      if (error) {
        console.error('Error starring channel:', error)
        setChannels(prev => prev.map(ch => ch.id === channelId ? { ...ch, is_starred: !isStarred } : ch))
      }
    },
    [supabase, userId]
  )

  const starDm = useCallback(
    async (conversationId: string, isStarred: boolean) => {
      setDms(prev => prev.map(dm => dm.id === conversationId ? { ...dm, is_starred: isStarred } : dm))
      const { error } = await supabase
        .from('dm_members')
        .update({ is_starred: isStarred } as any)
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
      if (error) {
        console.error('Error starring DM:', error)
        setDms(prev => prev.map(dm => dm.id === conversationId ? { ...dm, is_starred: !isStarred } : dm))
      }
    },
    [supabase, userId]
  )

  const markChannelRead = useCallback(
    async (channelId: string) => {
      const now = new Date().toISOString()
      setChannels(prev => prev.map(ch => ch.id === channelId ? { ...ch, unread_count: 0, last_read_at: now } : ch))
      await supabase
        .from('channel_members')
        .update({ last_read_at: now } as any)
        .eq('channel_id', channelId)
        .eq('user_id', userId)
    },
    [supabase, userId]
  )

  const markDmRead = useCallback(
    async (conversationId: string) => {
      const now = new Date().toISOString()
      setDms(prev => prev.map(dm => dm.id === conversationId ? { ...dm, unread_count: 0, last_read_at: now } : dm))
      await supabase
        .from('dm_members')
        .update({ last_read_at: now } as any)
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
    },
    [supabase, userId]
  )

  const fetchArchivedChannels = useCallback(async () => {
    const { data } = await supabase
      .from('channels')
      .select('*, channel_members!inner(user_id)')
      .eq('workspace_id', workspaceId)
      .eq('is_archived', true)
      .eq('channel_members.user_id', userId)
      .order('name')
    return (data ?? []) as import('@/types').Channel[]
  }, [supabase, workspaceId, userId])

  const unarchiveChannel = useCallback(async (channelId: string) => {
    await supabase.from('channels').update({ is_archived: false } as any).eq('id', channelId)
    await fetchAll()
  }, [supabase, fetchAll])

  return {
    workspace,
    channels,
    dms,
    members,
    loading,
    refresh: fetchAll,
    fetchUnreadCounts,
    createChannel,
    createDm,
    removeChannelMember,
    updateChannelRole,
    addChannelMember,
    updateWorkspaceMemberRole,
    removeWorkspaceMember,
    createInvite,
    getInvites,
    pinChannel,
    starChannel,
    starDm,
    markChannelRead,
    markDmRead,
    fetchArchivedChannels,
    unarchiveChannel,
  }
}
