'use client'

import { useEffect } from 'react'

const REFRESH_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Silently reloads the page every 5 minutes while the tab is visible.
 * Only fires when the tab has focus so it doesn't interrupt the user.
 * Uses a hard reload (not router.refresh) to avoid following server redirects.
 */
export function AutoRefresh() {
  useEffect(() => {
    const id = setInterval(() => {
      // Only reload if the tab is visible and focused
      if (document.visibilityState === 'visible' && document.hasFocus()) {
        window.location.reload()
      }
    }, REFRESH_INTERVAL_MS)

    return () => clearInterval(id)
  }, [])

  return null
}
