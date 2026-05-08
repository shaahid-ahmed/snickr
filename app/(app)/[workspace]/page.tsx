import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'

interface WorkspaceHomeProps {
  params: Promise<{ workspace: string }>
}

export default async function WorkspaceHome({ params }: WorkspaceHomeProps) {
  const { workspace: slug } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Find the workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('slug', slug)
    .single()

  if (!workspace) redirect('/')

  // Redirect to the first channel the user belongs to
  const { data: member } = await supabase
    .from('channel_members')
    .select('channel_id, channels!inner(workspace_id, is_archived)')
    .eq('user_id', user.id)
    .eq('channels.workspace_id', workspace.id)
    .eq('channels.is_archived', false)
    .order('joined_at', { ascending: true })
    .limit(1)
    .single()

  if (member) {
    redirect(`/${slug}/channel/${member.channel_id}`)
  }

  // No channels yet — show empty state
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
      <span className="text-5xl">👋</span>
      <h1 className="text-2xl font-semibold text-ink">Welcome to {slug}!</h1>
      <p className="text-ink-3 max-w-sm">
        You haven't joined any channels yet. Create a channel from the sidebar to get started.
      </p>
    </div>
  )
}
