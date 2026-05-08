# Snickr

> Team messaging, minus the noise.

Snickr is a real-time team messaging application built with Next.js 16, React 19, and Supabase. It provides workspaces, channels, direct messages, emoji reactions, polls, file attachments, typing indicators, and full-text search - all backed by PostgreSQL with row-level security.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Supabase Setup](#supabase-setup)
  - [Running Locally](#running-locally)
- [Authentication](#authentication)
- [Real-time Architecture](#real-time-architecture)
- [Feature Flags](#feature-flags)
- [Scripts](#scripts)
- [Contributing](#contributing)

---

## Features

| Feature | Status |
|---|---|
| Email/password authentication | Live |
| Workspaces with invite links | Live |
| Public & private channels | Live |
| Direct messages (1-on-1 and group) | Live |
| Real-time messaging via Supabase Realtime | Live |
| Typing indicators | Live |
| Emoji reactions | Live |
| File attachments | Live |
| Message search (full-text) | Live |
| Polls | Live |
| Notifications (mentions & DMs) | Live |
| Starred/pinned channels | Live |
| User status (available / busy / away) | Live |
| Do-not-disturb mode | Live |
| Channel archiving | Live |
| User blocking & muting | Live |
| One-time view messages | Live |
| AI assistant / smart search | Planned (Phase 4) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.4 (App Router) |
| UI | React 19, TypeScript 5.7.3 |
| Styling | Tailwind CSS 3.4.17, Geist fonts |
| Icons | Lucide React |
| Emoji Picker | emoji-mart / @emoji-mart/react |
| Backend / Auth | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| Server-side Auth | @supabase/ssr |
| CSS Utilities | clsx, tailwind-merge |
| Build Tooling | Next.js compiler, PostCSS, Autoprefixer |

---

## Project Structure

```
snickr/
├── app/
│   ├── (auth)/                    # Unauthenticated routes
│   │   ├── login/                 # Sign-in page
│   │   └── signup/                # Registration page
│   ├── (app)/
│   │   └── [workspace]/           # Dynamic workspace slug
│   │       ├── page.tsx           # Redirects to first channel
│   │       ├── layout.tsx         # Workspace layout
│   │       ├── channel/[id]/      # Channel chat view
│   │       │   └── page.tsx
│   │       ├── dm/[id]/           # DM conversation view
│   │       │   └── page.tsx
│   │       ├── channel/actions.ts # Server actions for channels
│   │       └── dm/actions.ts      # Server actions for DMs
│   ├── auth/callback/             # Email confirmation handler
│   ├── create-workspace/          # Workspace creation flow
│   ├── invite/[token]/            # Invite link landing
│   ├── settings/                  # User profile settings
│   ├── layout.tsx                 # Root layout + AuthProvider
│   ├── page.tsx                   # Root redirect
│   └── middleware.ts              # Auth gating
│
├── components/                    # React components
│   ├── Sidebar.tsx                # Channel/DM list + workspace switcher
│   ├── ChatView.tsx               # Main chat container (channels & DMs)
│   ├── MessageList.tsx            # Real-time message list
│   ├── MessageInput.tsx           # Text input + emoji + file upload
│   ├── EmojiPicker.tsx            # Emoji picker
│   ├── PollCreator.tsx            # Poll creation form
│   ├── PollMessage.tsx            # Poll display and voting
│   ├── SearchModal.tsx            # Full-text search modal
│   ├── NotificationsPanel.tsx     # Notification center
│   ├── ChannelSettingsModal.tsx   # Channel admin settings
│   ├── WorkspaceSettingsModal.tsx # Workspace admin settings
│   ├── UserProfileModal.tsx       # User profile card
│   ├── NewDmModal.tsx             # Start a new DM
│   ├── TypingIndicator.tsx        # "User is typing…" display
│   ├── Avatar.tsx                 # Profile picture component
│   ├── AttachmentPreview.tsx      # File attachment preview
│   ├── MediaPanel.tsx             # Channel media/attachments sidebar
│   └── providers/
│       └── AuthProvider.tsx       # Client-side auth context
│
├── hooks/                         # Custom React hooks
│   ├── useMessages.ts             # Fetch + subscribe to messages
│   ├── useRealtime.ts             # Supabase realtime subscription wrapper
│   ├── useTyping.ts               # Broadcast and receive typing events
│   ├── useNotifications.ts        # Fetch and subscribe to notifications
│   ├── useChannelMedia.ts         # Fetch channel attachments
│   ├── useWorkspace.ts            # Current workspace context
│   └── useWorkspaces.ts           # User's workspace list
│
├── lib/
│   ├── supabase.ts                # Browser Supabase client (singleton)
│   ├── supabase-server.ts         # Server-side Supabase clients
│   ├── utils.ts                   # cn(), formatTime(), formatDate(), slugify()
│   └── features.ts                # Feature flag definitions
│
├── types/
│   └── index.ts                   # TypeScript types for all DB rows
│
└── supabase/
    ├── config.toml
    └── migrations/
        ├── 0001_base.sql          # Core schema
        ├── 0002_features.sql      # Starring, pinning, unread counts
        ├── 0003_reactions.sql     # Message reactions
        ├── 0004_media_rpc.sql     # get_channel_media() RPC
        ├── 0005_notifications.sql # Notifications + triggers
        ├── 0006_misc.sql          # Polls, archiving, channel logos, blocked users
        └── 0007_muted_users.sql   # Muted users
```

---

## Database Schema

All tables use PostgreSQL with row-level security (RLS) enforced through helper functions (`is_workspace_member`, `is_channel_member`, `is_dm_member`).

### Tables

| Table | Purpose |
|---|---|
| `profiles` | User accounts (username, full name, avatar, status, notification prefs) |
| `workspaces` | Team spaces with slug-based URLs |
| `workspace_members` | Workspace membership with roles: `owner`, `admin`, `member` |
| `workspace_invites` | Shareable invite tokens with expiry and use limits |
| `channels` | Channels within a workspace (public/private, archivable) |
| `channel_members` | Channel membership, starring, pinning, last-read tracking |
| `dm_conversations` | DM group containers |
| `dm_members` | DM participants, starring, last-read tracking |
| `messages` | All messages (channel or DM), with soft delete and one-time view support |
| `attachments` | Files attached to messages (name, URL, MIME type, size, download/forward flags) |
| `message_reactions` | Per-user emoji reactions on messages |
| `notifications` | In-app notifications for mentions and DMs |
| `polls` | Poll questions (anonymous, multi-select, time-limited options) |
| `poll_options` | Answer choices per poll |
| `poll_votes` | Per-user votes |
| `blocked_users` | User-to-user blocking |
| `muted_users` | User-to-user muting |

### Enums

```sql
user_status:    available | busy | away
workspace_role: owner | admin | member
channel_role:   admin | member
```

### Full-Text Search

Messages have a generated `search_vector` column indexed with GIN for efficient FTS:

```sql
ALTER TABLE messages
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;

CREATE INDEX messages_search_idx ON messages USING GIN (search_vector);
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- A [Supabase](https://supabase.com) project (free tier works)

### Environment Variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are found in **Project Settings → API** in the Supabase dashboard.
- `SUPABASE_SERVICE_ROLE_KEY` is the secret key used for server-side operations that bypass RLS. Never expose this to the client.

### Supabase Setup

Run all migrations against your Supabase project using the Supabase CLI:

```bash
npx supabase link --project-ref your-project-ref
npx supabase db push
```

Or apply each migration file manually from the SQL editor in the Supabase dashboard, in order:

1. `supabase/migrations/0001_base.sql`
2. `supabase/migrations/0002_features.sql`
3. `supabase/migrations/0003_reactions.sql`
4. `supabase/migrations/0004_media_rpc.sql`
5. `supabase/migrations/0005_notifications.sql`
6. `supabase/migrations/0006_misc.sql`
7. `supabase/migrations/0007_muted_users.sql`

Enable Realtime on the `messages`, `channels`, `channel_members`, and `dm_members` tables in **Database → Replication** in the Supabase dashboard.

### Running Locally

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign up, confirm your email, and create your first workspace.

---

## Authentication

Snickr uses Supabase Auth with email/password sign-up. Email confirmation is required before accessing the app.

**Sign-up flow:**
1. User registers at `/signup` with email, password, full name, and username.
2. Supabase sends a confirmation email.
3. User clicks the link → `/auth/callback` exchanges the code for a session stored in cookies.
4. Authenticated users are redirected to their first workspace.

**Auto-profile creation:** A PostgreSQL trigger (`handle_new_user`) automatically inserts a row into `profiles` when a new auth user is created, deriving the username from their email or signup metadata.

**Session management:** The Next.js middleware (using `@supabase/ssr`) refreshes the session cookie on every request and redirects unauthenticated traffic to `/login`, preserving the intended destination via a `returnTo` query parameter.

---

## Real-time Architecture

Real-time updates are powered by Supabase Realtime (backed by PostgreSQL logical replication).

| Feature | Mechanism |
|---|---|
| New messages | `postgres_changes` on `messages` table |
| Typing indicators | Supabase Broadcast channels (ephemeral, no DB write) |
| Notifications | `postgres_changes` on `notifications` table |
| Channel/membership updates | `postgres_changes` on `channels`, `channel_members` |

The `useRealtime` hook wraps Supabase channel subscriptions with automatic cleanup on component unmount. The browser Supabase client is a singleton to prevent WebSocket leaks from multiple instances.

---

## Feature Flags

Feature availability is controlled in [`lib/features.ts`](lib/features.ts) through a phased rollout system:

| Phase | Features |
|---|---|
| Phase 1 (Core) | Auth, workspaces, channels, DMs, real-time messaging, basic notifications |
| Phase 2 (Engagement) | Emoji reactions, pinned messages, starred channels, unread tracking, message search, edit/delete |
| Phase 3 (Power User) | Polls, one-time messages, DND status, channel archiving, channel logos, mention notifications |
| Phase 4 (AI) | AI assistant, smart search, thread summaries, reply suggestions |

Toggle a flag to `true` in `features.ts` to enable the corresponding UI:

```ts
export const FEATURES = {
  EMOJI_REACTIONS: true,   // enable emoji reactions
  POLLS: false,            // polls still off
  AI_ASSISTANT: false,     // not yet implemented
};
```

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server at http://localhost:3000 |
| `npm run build` | Create optimized production build |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint |

---

## Contributing

1. Fork the repository and create a branch from `main`.
2. Run `npm install` and `npm run dev` to verify your setup.
3. Make your changes and ensure `npm run lint` passes.
4. Open a pull request with a clear description of what changed and why.

---

## License

MIT — see [LICENSE](LICENSE).
