'use client'

import { Plus, Check, Settings } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { Avatar } from '@/components/Avatar'
import { cn } from '@/lib/utils'

interface WorkspaceSwitcherProps {
  currentWorkspaceId: string
  userId: string
  onClose: () => void
}

export function WorkspaceSwitcher({
  currentWorkspaceId,
  userId,
  onClose,
}: WorkspaceSwitcherProps) {
  const router = useRouter()
  const { workspaces, loading } = useWorkspaces(userId)

  return (
    <div className="w-64 bg-white rounded-xl shadow-2xl border border-surface-3 overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b bg-surface-faint">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-ink-4">
          Your Workspaces
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[300px] p-2 space-y-1">
        {loading ? (
          <div className="p-4 text-center text-xs text-ink-4">Loading...</div>
        ) : (
          workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => {
                router.push(`/${ws.slug}`)
                onClose()
              }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group text-left',
                ws.id === currentWorkspaceId
                  ? 'bg-brand-faint text-brand-dark'
                  : 'hover:bg-surface text-ink-2'
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-md flex items-center justify-center font-bold text-sm transition-colors",
                ws.id === currentWorkspaceId ? "bg-brand text-white" : "bg-surface-3 text-ink-3 group-hover:bg-surface-4"
              )}>
                {ws.name[0].toUpperCase()}
              </div>
              <span className="flex-1 truncate font-medium text-sm">
                {ws.name}
              </span>
              {ws.id === currentWorkspaceId && (
                <Check size={14} className="text-brand" />
              )}
            </button>
          ))
        )}
      </div>

      <div className="p-2 border-t bg-surface-faint">
        <Link
          href="/create-workspace"
          onClick={onClose}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-ink-3 hover:bg-surface hover:text-ink transition-colors text-sm font-medium"
        >
          <div className="w-8 h-8 rounded-md bg-white border border-dashed border-surface-4 flex items-center justify-center">
            <Plus size={16} />
          </div>
          Create a workspace
        </Link>
      </div>
    </div>
  )
}
