'use server'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { UserStatus } from '@/types'

export async function updateProfile(data: {
  full_name:      string
  username:       string
  status:         UserStatus
  is_dnd:         boolean
  notif_mentions: boolean
  notif_dms:      boolean
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const username = data.username.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  if (!username) return { error: 'Username is required' }

  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .neq('id', user.id)
    .maybeSingle()

  if (existing) return { error: 'Username already taken' }

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name:      data.full_name.trim() || null,
      username,
      status:         data.status,
      is_dnd:         data.is_dnd,
      notif_mentions: data.notif_mentions,
      notif_dms:      data.notif_dms,
      updated_at:     new Date().toISOString(),
    } as any)
    .eq('id', user.id)

  if (error) return { error: error.message }
  return { success: true }
}
