import { notFound, redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Sidebar } from '@/components/Sidebar'
import { AutoRefresh } from '@/components/AutoRefresh'
import type { Workspace } from '@/types'

interface WorkspaceLayoutProps {
  children: React.ReactNode
  params:   Promise<{ workspace: string }>
}

export default async function WorkspaceLayout({ children, params }: WorkspaceLayoutProps) {
  const { workspace: slug } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: wsRaw } = await supabase
    .from('workspaces')
    .select('*')
    .eq('slug', slug)
    .single()

  const workspace = wsRaw as Workspace | null
  if (!workspace) return notFound()

  const { data: member } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspace.id)
    .eq('user_id', user.id)
    .single()

  if (!member) redirect('/')

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <AutoRefresh />
      <Sidebar
        workspaceSlug={workspace.slug}
        workspaceId={workspace.id}
        workspaceName={workspace.name}
        userId={user.id}
      />
      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        {children}
      </main>
    </div>
  )
}
