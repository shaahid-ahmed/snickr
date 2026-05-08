import { notFound, redirect } from 'next/navigation'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'
import { ChatView } from '@/components/ChatView'
import type { Channel, ChannelRole, Workspace } from '@/types'

interface ChannelPageProps {
  params: Promise<{ workspace: string; id: string }>
}

export default async function ChannelPage({ params }: ChannelPageProps) {
  const { workspace: slug, id: channelId } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: channelRaw } = await supabase
    .from('channels')
    .select('*')
    .eq('id', channelId)
    .single()

  const channel = channelRaw as Channel | null
  if (!channel) return notFound()

  // Verify workspace slug matches URL
  const { data: wsRaw } = await supabase
    .from('workspaces')
    .select('slug')
    .eq('id', channel.workspace_id)
    .single()

  const ws = wsRaw as Pick<Workspace, 'slug'> | null
  if (!ws || ws.slug !== slug) return notFound()

  // Fetch channel membership + workspace role in parallel
  const [{ data: chMemberRaw }, { data: wsMemberRaw }] = await Promise.all([
    supabase
      .from('channel_members')
      .select('user_id, role')
      .eq('channel_id', channelId)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', channel.workspace_id)
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  const chMember  = chMemberRaw  as { user_id: string; role: string } | null
  const wsMember  = wsMemberRaw  as { role: string } | null

  if (!chMember) {
    if (channel.is_private) redirect(`/${slug}`)
    // Auto-join public channel via service role (bypasses RLS)
    const admin = createServiceClient()
    await admin.from('channel_members').insert({
      channel_id: channelId,
      user_id:    user.id,
      role:       'member',
    })
  }

  // isAdmin: explicit channel admin  OR  workspace owner/admin
  const wsRole   = wsMember?.role ?? 'member'
  const isWsAdmin = wsRole === 'owner' || wsRole === 'admin'
  const userRole: ChannelRole =
    chMember?.role === 'admin' || isWsAdmin ? 'admin' : 'member'

  return (
    <ChatView
      workspaceId={channel.workspace_id}
      workspaceSlug={slug}
      channel={channel}
      currentUserId={user.id}
      userRole={userRole}
    />
  )
}
