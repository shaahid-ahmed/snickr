'use server'

import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'

/**
 * Find an existing 1-on-1 DM between the caller and targetUserId in this workspace,
 * or create a new one. Returns the conversation ID.
 */
export async function createOrGetDm(workspaceId: string, targetUserId: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Find conversations the current user belongs to in this workspace
  const { data: mine } = await supabase
    .from('dm_members')
    .select('conversation_id, dm_conversations!inner(workspace_id)')
    .eq('user_id', user.id)

  const myConvIds = (mine ?? [])
    .filter((m: any) => m.dm_conversations?.workspace_id === workspaceId)
    .map((m: any) => m.conversation_id as string)

  if (myConvIds.length > 0) {
    // Check if target is also in any of those conversations
    const { data: shared } = await supabase
      .from('dm_members')
      .select('conversation_id')
      .eq('user_id', targetUserId)
      .in('conversation_id', myConvIds)
      .limit(1)
      .maybeSingle()

    if (shared) return { conversationId: shared.conversation_id }
  }

  // Create a new conversation + add both members via service role (bypasses RLS)
  const admin = createServiceClient()

  const { data: conv, error: convErr } = await admin
    .from('dm_conversations')
    .insert({ workspace_id: workspaceId })
    .select()
    .single()

  if (convErr || !conv) return { error: convErr?.message ?? 'Failed to create conversation' }

  const { error: memErr } = await admin.from('dm_members').insert([
    { conversation_id: conv.id, user_id: user.id },
    { conversation_id: conv.id, user_id: targetUserId },
  ])

  if (memErr) return { error: memErr.message }

  return { conversationId: conv.id as string }
}
