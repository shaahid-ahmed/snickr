'use server'

import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'
import { slugify } from '@/lib/utils'

export async function createWorkspace(name: string, slug: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const finalSlug = slug.trim() || slugify(name)

  // Check slug availability (no auth needed — just a read)
  const { data: existing } = await supabase
    .from('workspaces')
    .select('id')
    .eq('slug', finalSlug)
    .maybeSingle()

  if (existing) return { error: 'That workspace URL is already taken. Try a different name.' }

  // Use service role for all writes — bypasses RLS for trusted server-side creation
  const admin = createServiceClient()

  const { data: workspace, error: wsErr } = await admin
    .from('workspaces')
    .insert({ name: name.trim(), slug: finalSlug, owner_id: user.id })
    .select()
    .single()

  if (wsErr || !workspace) return { error: wsErr?.message ?? 'Failed to create workspace.' }

  await admin.from('workspace_members').insert({
    workspace_id: workspace.id,
    user_id:      user.id,
    role:         'owner',
  })

  const { data: channel } = await admin
    .from('channels')
    .insert({
      workspace_id: workspace.id,
      name:         'general',
      description:  'General discussion',
      created_by:   user.id,
    })
    .select()
    .single()

  if (channel) {
    await admin.from('channel_members').insert({
      channel_id: channel.id,
      user_id:    user.id,
    })
    return { redirectTo: `/${workspace.slug}/channel/${channel.id}` }
  }

  return { redirectTo: `/${workspace.slug}` }
}
