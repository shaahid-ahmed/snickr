'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Workspace } from '@/types'

export function useWorkspaces(userId: string) {
  const supabase = createClient()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)

  const fetchWorkspaces = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    
    const { data, error } = await supabase
      .from('workspace_members')
      .select('workspaces(*)')
      .eq('user_id', userId)

    if (error) {
      console.error('Error fetching workspaces:', error)
    } else if (data) {
      setWorkspaces((data as any[]).map(d => d.workspaces).filter(Boolean))
    }
    setLoading(false)
  }, [supabase, userId])

  useEffect(() => {
    void fetchWorkspaces()
  }, [fetchWorkspaces])

  return { workspaces, loading, refresh: fetchWorkspaces }
}
