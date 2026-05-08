export const FEATURES = {
  // ── Phase 1: Base (always on) ─────────────────────────
  AUTH:                  true,
  WORKSPACES:            true,
  CHANNELS:              true,
  DIRECT_MESSAGES:       true,
  REALTIME_MESSAGING:    true,
  BASIC_NOTIFICATIONS:   true,

  // ── Phase 2: Engagement ───────────────────────────────
  EMOJI_REACTIONS:       false,
  PINNED_MESSAGES:       false,
  PINNED_CHANNELS:       false,
  UNREAD_SECTION:        false,
  FAVOURITES_SECTION:    false,
  MESSAGE_SEARCH:        false,
  EDIT_DELETE_MESSAGES:  false,
  MEDIA_TAB:             false,

  // ── Phase 3: Power user ───────────────────────────────
  POLLS:                 false,
  ONE_TIME_MESSAGES:     false,
  DND_STATUS:            false,
  CHANNEL_ARCHIVING:     false,
  CHANNEL_LOGO:          false,
  EXPENSE_SPLITS:        false,
  ACTIVITIES_FEED:       false,
  GHOST_COUNTER:         false,
  MENTION_NOTIFICATIONS: false,
  DOC_RESTRICTIONS:      false,
  READ_RECEIPTS:         false,

  // ── Phase 4: AI ───────────────────────────────────────
  AI_ASSISTANT:          false,
  SMART_SEARCH:          false,
  THREAD_SUMMARY:        false,
  REPLY_SUGGESTIONS:     false,
} as const

export type FeatureKey = keyof typeof FEATURES
export type Features   = typeof FEATURES

// Use this in components to guard feature-flagged UI:
// if (!FEATURES.EMOJI_REACTIONS) return null