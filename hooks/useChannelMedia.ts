'use client'

import { useCallback, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { MediaItem } from '@/types'

interface UseChannelMediaOptions {
  channelId?:      string
  conversationId?: string
}

const PAGE = 48   // divisible by 3 for clean grid rows

export function useChannelMedia({ channelId, conversationId }: UseChannelMediaOptions) {
  
  const supabase = createClient()
  const [items,   setItems]   = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const offsetRef = useRef(0)

  const load = useCallback(async (fromOffset = 0) => {
    if (!channelId && !conversationId) return
    setLoading(true)

    const { data, error } = await supabase.rpc('get_channel_media', {
      p_channel_id:      channelId      ?? null,
      p_conversation_id: conversationId ?? null,
      p_limit:  PAGE + 1,
      p_offset: fromOffset,
    })

    if (error) { console.error('get_channel_media error:', error); setLoading(false); return }

    const rows        = (data ?? []) as MediaItem[]
    const hasMoreData = rows.length > PAGE
    const page        = hasMoreData ? rows.slice(0, PAGE) : rows

    setHasMore(hasMoreData)
    setItems(prev => fromOffset === 0 ? page : [...prev, ...page])
    offsetRef.current = fromOffset + page.length
    setLoading(false)
  }, [supabase, channelId, conversationId])

  const reload   = useCallback(() => { offsetRef.current = 0; void load(0) },  [load])
  const loadMore = useCallback(() => void load(offsetRef.current), [load])

  return { items, loading, hasMore, reload, loadMore }
}
