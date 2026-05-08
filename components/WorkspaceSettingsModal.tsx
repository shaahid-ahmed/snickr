'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, UserPlus, UserMinus, Search, Link as LinkIcon, Check, Copy } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { useWorkspace } from '@/hooks/useWorkspace'
import type { WorkspaceRole, WorkspaceInvite } from '@/types'

interface WorkspaceSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  workspaceId: string
  workspaceName: string
  currentUserId: string
  currentUserRole: WorkspaceRole
}

export function WorkspaceSettingsModal({
  isOpen,
  onClose,
  workspaceId,
  workspaceName,
  currentUserId,
  currentUserRole,
}: WorkspaceSettingsModalProps) {
  const { 
    members, 
    updateWorkspaceMemberRole, 
    removeWorkspaceMember, 
    createInvite,
    getInvites
  } = useWorkspace(workspaceId, currentUserId)

  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'members' | 'invites'>('members')
  const [invites, setInvites] = useState<WorkspaceInvite[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const isAdmin = currentUserRole === 'owner' || currentUserRole === 'admin'

  const fetchInvites = useCallback(async () => {
    const data = await getInvites()
    setInvites(data)
  }, [getInvites])

  useEffect(() => {
    if (isOpen && tab === 'invites') {
      void fetchInvites()
    }
  }, [isOpen, tab, fetchInvites])

  if (!isOpen) return null

  const filteredMembers = members.filter(m =>
    m.profile.username.toLowerCase().includes(search.toLowerCase()) ||
    (m.profile.full_name?.toLowerCase().includes(search.toLowerCase()) ?? false)
  )

  async function handleRoleChange(userId: string, role: WorkspaceRole) {
    await updateWorkspaceMemberRole(userId, role)
  }

  async function handleRemove(userId: string) {
    if (confirm('Are you sure you want to remove this member from the workspace?')) {
      await removeWorkspaceMember(userId)
    }
  }

  async function handleCreateInvite() {
    setLoading(true)
    const invite = await createInvite()
    if (invite) {
      void fetchInvites()
    }
    setLoading(false)
  }

  function copyInviteLink(id: string) {
    const url = `${window.location.origin}/invite/${id}`
    void navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-white">
          <div>
            <h2 className="font-bold text-ink text-lg">{workspaceName} Settings</h2>
            <p className="text-xs text-ink-4">Manage workspace members and invites</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-surface rounded-md text-ink-4 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 border-b bg-surface-faint">
          <button
            onClick={() => setTab('members')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === 'members' ? 'border-brand text-brand' : 'border-transparent text-ink-3 hover:text-ink'
            }`}
          >
            Members ({members.length})
          </button>
          <button
            onClick={() => setTab('invites')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === 'invites' ? 'border-brand text-brand' : 'border-transparent text-ink-3 hover:text-ink'
            }`}
          >
            Invites
          </button>
        </div>

        {/* Search / Action Bar */}
        <div className="p-4 border-b bg-white flex gap-4">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4"
            />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-surface border-0 rounded-lg pl-10 pr-4 py-2
                         text-sm text-ink placeholder:text-ink-4 focus:ring-2
                         focus:ring-brand/20 transition-all outline-none"
            />
          </div>
          {tab === 'invites' && isAdmin && (
            <button
              onClick={handleCreateInvite}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg
                         text-sm font-medium hover:bg-brand-dark transition-colors disabled:opacity-50"
            >
              <UserPlus size={18} />
              Create Invite
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 bg-white">
          {tab === 'members' ? (
            <div className="space-y-1">
              {filteredMembers.map(member => {
                const isSelf = member.user_id === currentUserId
                const canManage = isAdmin && !isSelf && member.role !== 'owner'
                
                return (
                  <div
                    key={member.user_id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface group"
                  >
                    <Avatar
                      src={member.profile.avatar_url}
                      username={member.profile.username}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-ink truncate">
                          {member.profile.full_name ?? member.profile.username}
                        </p>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          member.role === 'owner' ? 'bg-amber-100 text-amber-700' :
                          member.role === 'admin' ? 'bg-brand-faint text-brand-dark' :
                          'bg-surface-3 text-ink-3'
                        }`}>
                          {member.role}
                        </span>
                      </div>
                      <p className="text-xs text-ink-4 truncate">@{member.profile.username}</p>
                    </div>

                    {canManage && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.user_id, e.target.value as WorkspaceRole)}
                          className="text-xs border-surface-3 rounded-md py-1 px-2 focus:ring-brand focus:border-brand"
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button
                          onClick={() => handleRemove(member.user_id)}
                          className="p-1.5 hover:bg-white rounded-md text-ink-3 hover:text-red-500 transition-colors"
                          title="Remove from workspace"
                        >
                          <UserMinus size={16} />
                        </button>
                      </div>
                    )}
                    {isSelf && <span className="text-xs text-ink-4 italic px-2">You</span>}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {invites.length === 0 ? (
                <div className="p-8 text-center text-ink-4">
                  <LinkIcon size={32} className="mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No active invites. Create one to invite people!</p>
                </div>
              ) : (
                invites.map(invite => (
                  <div key={invite.id} className="border rounded-xl p-4 flex items-center justify-between group bg-surface-faint/50">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-xs font-mono bg-white px-2 py-0.5 rounded border border-surface-3 text-brand-dark">
                          {invite.id.slice(0, 8)}...
                        </code>
                        <span className="text-[10px] text-ink-4 uppercase font-bold tracking-tighter">
                          Expires {new Date(invite.expires_at!).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-ink-3 truncate max-w-xs">
                        Used {invite.use_count} times
                      </p>
                    </div>
                    <button
                      onClick={() => copyInviteLink(invite.id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        copiedId === invite.id 
                        ? 'bg-green-500 text-white' 
                        : 'bg-white border border-surface-3 text-ink-2 hover:border-brand hover:text-brand-dark shadow-sm'
                      }`}
                    >
                      {copiedId === invite.id ? <Check size={14} /> : <Copy size={14} />}
                      {copiedId === invite.id ? 'Copied!' : 'Copy Link'}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-surface-faint flex justify-end">
          <button
            onClick={onClose}
            className="btn-ghost"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
