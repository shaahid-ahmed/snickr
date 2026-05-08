// ─── Database row types ────────────────────────────────────────────────────
// These mirror your Supabase tables exactly.
// As you add migrations, add the matching types here.

export type UserStatus = 'available' | 'busy' | 'away'
export type WorkspaceRole = 'owner' | 'admin' | 'member'
export type ChannelRole = 'admin' | 'member'

export interface Profile {
  id: string
  username: string
  full_name: string | null
  avatar_url: string | null
  status: UserStatus
  is_dnd: boolean
  notif_mentions: boolean
  notif_dms:      boolean
  created_at: string
  updated_at: string
}

export interface Notification {
  id:              string
  user_id:         string
  workspace_id:    string
  type:            'mention' | 'dm'
  message_id:      string | null
  channel_id:      string | null
  conversation_id: string | null
  from_user_id:    string | null
  content_preview: string | null
  is_read:         boolean
  created_at:      string
  // joined
  from_user?: Pick<Profile, 'id' | 'username' | 'full_name' | 'avatar_url'>
  channel?:   { id: string; name: string } | null
}

export interface Workspace {
  id: string
  name: string
  slug: string
  logo_url: string | null
  owner_id: string
  created_at: string
}

export interface WorkspaceMember {
  workspace_id: string
  user_id: string
  role: WorkspaceRole
  joined_at: string
  profile: Profile          // mandatory in joined context
}

export interface WorkspaceInvite {
  id: string
  workspace_id: string
  created_by: string
  expires_at: string | null
  max_uses: number | null
  use_count: number
  created_at: string
}

export interface Channel {
  id: string
  workspace_id: string
  name: string
  description: string | null
  is_private: boolean
  is_archived: boolean
  logo_url: string | null
  created_by: string
  created_at: string
  // joined fields (optional, populated by specific queries)
  unread_count?: number
  is_pinned?: boolean
  is_starred?: boolean
  last_read_at?: string | null
}

export interface ChannelMember {
  channel_id: string
  user_id: string
  role: ChannelRole
  is_pinned: boolean
  is_starred: boolean
  last_read_at: string | null
  joined_at: string
  profile?: Profile // joined
}

export interface DmConversation {
  id: string
  workspace_id: string
  created_at: string
  // joined fields
  other_members?: Profile[]
  unread_count?: number
  is_starred?: boolean
  last_read_at?: string | null
}

export interface DmMember {
  conversation_id: string
  user_id: string
  is_starred: boolean
  last_read_at: string | null
}

export interface Message {
  id: string
  workspace_id: string
  channel_id: string | null
  conversation_id: string | null
  sender_id: string
  content: string
  edited_at: string | null
  is_deleted: boolean
  is_pinned: boolean
  pinned_by: string | null
  pinned_at: string | null
  thread_parent_id: string | null
  is_one_time: boolean
  viewed_by: string[] | null
  is_restricted: boolean
  poll_id: string | null
  created_at: string
  // joined fields
  sender?: Profile
  attachments?: Attachment[]
  reactions?: MessageReaction[]
  poll?: Poll | null
  reply_count?: number
}

export interface Poll {
  id: string
  workspace_id: string
  question: string
  allows_multiple: boolean
  is_anonymous: boolean
  created_by: string
  ends_at: string | null
  created_at: string
  poll_options?: PollOption[]
}

export interface PollOption {
  id: string
  poll_id: string
  text: string
  position: number
}

export interface PollVote {
  poll_id: string
  option_id: string
  user_id: string
  created_at: string
  // joined
  voter?: Pick<Profile, 'id' | 'username' | 'full_name' | 'avatar_url'>
}

export interface BlockedUser {
  blocker_id: string
  blocked_id: string
  created_at: string
}

export interface MutedUser {
  muter_id:  string
  muted_id:  string
  created_at: string
}

export interface Attachment {
  id: string
  message_id: string
  name: string
  url: string
  mime_type: string
  size_bytes: number | null
  created_at: string
}

/** Returned by the get_channel_media RPC — attachment + sender context */
export interface MediaItem {
  id:                string
  message_id:        string
  name:              string
  url:               string
  mime_type:         string
  size_bytes:        number | null
  created_at:        string
  msg_created_at:    string
  sender_id:         string
  sender_username:   string
  sender_full_name:  string | null
  sender_avatar_url: string | null
}

export interface MessageReaction {
  id: string
  message_id: string
  user_id: string
  emoji: string
  created_at: string
}

// ─── Database generated types (Supabase codegen shape) ────────────────────
// This is what createBrowserClient<Database> expects.
// Extend each table's Row/Insert/Update as you add migrations.
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at' | 'ghost_count'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
        Relationships: never[]
      }
      workspaces: {
        Row: Workspace
        Insert: Omit<Workspace, 'id' | 'created_at'>
        Update: Partial<Omit<Workspace, 'id' | 'created_at'>>
        Relationships: never[]
      }
      workspace_members: {
        Row: WorkspaceMember
        Insert: Omit<WorkspaceMember, 'joined_at' | 'profile'>
        Update: Partial<Pick<WorkspaceMember, 'role'>>
        Relationships: never[]
      }
      workspace_invites: {
        Row: WorkspaceInvite
        Insert: Omit<WorkspaceInvite, 'id' | 'use_count' | 'created_at'>
        Update: Partial<Pick<WorkspaceInvite, 'use_count'>>
        Relationships: never[]
      }
      channels: {
        Row: Omit<Channel, 'unread_count' | 'is_pinned' | 'last_read_at'>
        Insert: Omit<Channel, 'id' | 'created_at' | 'unread_count' | 'is_pinned' | 'last_read_at'>
        Update: Partial<Omit<Channel, 'id' | 'workspace_id' | 'created_at' | 'unread_count' | 'is_pinned' | 'last_read_at'>>
        Relationships: never[]
      }
      channel_members: {
        Row: ChannelMember
        Insert: { channel_id: string; user_id: string; role?: ChannelRole; is_pinned?: boolean; is_starred?: boolean; last_read_at?: string | null }
        Update: Partial<Pick<ChannelMember, 'role' | 'is_pinned' | 'is_starred' | 'last_read_at'>>
        Relationships: never[]
      }
      dm_conversations: {
        Row: Omit<DmConversation, 'other_members' | 'unread_count' | 'last_read_at'>
        Insert: { workspace_id: string }
        Update: Record<string, never>
        Relationships: never[]
      }
      dm_members: {
        Row: DmMember
        Insert: { conversation_id: string; user_id: string; is_starred?: boolean; last_read_at?: string | null }
        Update: Partial<Pick<DmMember, 'is_starred' | 'last_read_at'>>
        Relationships: never[]
      }
      messages: {
        Row: Omit<Message, 'sender' | 'attachments' | 'reply_count' | 'poll'>
        Insert: {
          workspace_id: string
          channel_id?: string | null
          conversation_id?: string | null
          sender_id: string
          content?: string
          edited_at?: string | null
          is_deleted?: boolean
          thread_parent_id?: string | null
          is_one_time?: boolean
          viewed_by?: string[]
          is_restricted?: boolean
          poll_id?: string | null
        }
        Update: {
          content?: string
          edited_at?: string | null
          is_deleted?: boolean
          is_pinned?: boolean
          pinned_by?: string | null
          pinned_at?: string | null
          viewed_by?: string[]
          is_restricted?: boolean
        }
        Relationships: never[]
      }
      polls: {
        Row: Poll
        Insert: Omit<Poll, 'id' | 'created_at' | 'poll_options'>
        Update: Partial<Omit<Poll, 'id' | 'created_at' | 'workspace_id' | 'created_by'>>
        Relationships: never[]
      }
      poll_options: {
        Row: PollOption
        Insert: Omit<PollOption, 'id'>
        Update: Partial<Omit<PollOption, 'id' | 'poll_id'>>
        Relationships: never[]
      }
      poll_votes: {
        Row: PollVote
        Insert: Omit<PollVote, 'created_at' | 'voter'>
        Update: Record<string, never>
        Relationships: never[]
      }
      blocked_users: {
        Row: BlockedUser
        Insert: Omit<BlockedUser, 'created_at'>
        Update: Record<string, never>
        Relationships: never[]
      }
      attachments: {
        Row: Attachment
        Insert: Omit<Attachment, 'id' | 'created_at'>
        Update: Record<string, never>
        Relationships: never[]
      }
      message_reactions: {
        Row: MessageReaction
        Insert: Omit<MessageReaction, 'id' | 'created_at'>
        Update: Record<string, never>
        Relationships: never[]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_status: UserStatus
      workspace_role: WorkspaceRole
      channel_role: ChannelRole
    }
  }
}