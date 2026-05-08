import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export default async function RootPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Find user's earliest workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .single()

  if (!membership) redirect('/create-workspace')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('slug')
    .eq('id', membership.workspace_id)
    .single()

  if (!workspace) redirect('/create-workspace')

  redirect(`/${workspace.slug}`)
}
