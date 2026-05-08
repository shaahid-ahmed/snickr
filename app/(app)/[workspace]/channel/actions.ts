'use server'

import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'
import type { ChannelRole } from '@/types'

/**
 * Returns true if the caller can administrate the channel.
 * Accepts: channel role = 'admin'  OR  workspace role = 'owner' | 'admin'.
 */
async function isChannelAdmin(channelId: string, callerId: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient()

  // 1. Check channel-level role first (fast path)
  const { data: chMember } = await supabase
    .from('channel_members')
    .select('role')
    .eq('channel_id', channelId)
    .eq('user_id', callerId)
    .maybeSingle()

  if (chMember?.role === 'admin') return true

  // 2. Fall back to workspace role (owner/admin can manage any channel)
  const { data: ch } = await supabase
    .from('channels')
    .select('workspace_id')
    .eq('id', channelId)
    .single()

  if (!ch) return false

  const { data: wsMember } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', ch.workspace_id)
    .eq('user_id', callerId)
    .maybeSingle()

  return wsMember?.role === 'owner' || wsMember?.role === 'admin'
}

export async function addMemberToChannel(channelId: string, targetUserId: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  if (!await isChannelAdmin(channelId, user.id))
    return { error: 'Only channel admins can add members' }

  const admin = createServiceClient()
  let { error } = await admin
    .from('channel_members')
    .insert({ channel_id: channelId, user_id: targetUserId, role: 'member' })

  // role column may not exist yet — retry without it
  if (error && error.message.includes('role')) {
    const res = await admin
      .from('channel_members')
      .insert({ channel_id: channelId, user_id: targetUserId })
    error = res.error
  }

  if (error && error.code !== '23505') return { error: error.message }
  return { success: true }
}

export async function removeMemberFromChannel(channelId: string, targetUserId: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  if (user.id !== targetUserId && !await isChannelAdmin(channelId, user.id))
    return { error: 'Only channel admins can remove members' }

  const admin = createServiceClient()
  const { error } = await admin
    .from('channel_members')
    .delete()
    .eq('channel_id', channelId)
    .eq('user_id', targetUserId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function updateMemberRole(
  channelId: string,
  targetUserId: string,
  role: ChannelRole,
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  if (!await isChannelAdmin(channelId, user.id))
    return { error: 'Only channel admins can change roles' }

  const admin = createServiceClient()
  const { error } = await admin
    .from('channel_members')
    .update({ role })
    .eq('channel_id', channelId)
    .eq('user_id', targetUserId)

  if (error) {
    if (error.message.includes('role')) return { error: 'Role column missing — run the schema migration first.' }
    return { error: error.message }
  }
  return { success: true }
}
