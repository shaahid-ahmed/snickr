import { notFound, redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { ChatView } from '@/components/ChatView'
import type { Profile } from '@/types'

interface DmPageProps {
  params: Promise<{ workspace: string; id: string }>
}

export default async function DmPage({ params }: DmPageProps) {
  const { workspace: slug, id: conversationId } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify user is a member of this conversation
  const { data: membership } = await supabase
    .from('dm_members')
    .select('conversation_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .single()

  if (!membership) return notFound()

  // Fetch workspace_id from the conversation
  const { data: convRaw } = await supabase
    .from('dm_conversations')
    .select('workspace_id')
    .eq('id', conversationId)
    .single()

  const conv = convRaw as { workspace_id: string } | null
  if (!conv) return notFound()

  // Verify workspace slug
  const { data: wsRaw } = await supabase
    .from('workspaces')
    .select('slug')
    .eq('id', conv.workspace_id)
    .single()

  const ws = wsRaw as { slug: string } | null
  if (!ws || ws.slug !== slug) return notFound()

  // Fetch other member profiles
  const { data: membersRaw } = await supabase
    .from('dm_members')
    .select('user_id, profiles(*)')
    .eq('conversation_id', conversationId)
    .neq('user_id', user.id)

  const others = (membersRaw ?? [])
    .map((m: any) => m.profiles as Profile)
    .filter(Boolean)

  return (
    <ChatView
      workspaceId={conv.workspace_id}
      workspaceSlug={slug}
      conversationId={conversationId}
      otherMembers={others}
      currentUserId={user.id}
    />
  )
}
