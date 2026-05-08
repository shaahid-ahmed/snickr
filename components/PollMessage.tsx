'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, BarChart2, ChevronDown, ChevronUp } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/components/providers/AuthProvider'
import { cn } from '@/lib/utils'
import type { Poll, PollOption, PollVote } from '@/types'

interface PollMessageProps {
  poll:          Poll
  currentUserId: string
}

export function PollMessage({ poll, currentUserId }: PollMessageProps) {
  
  const supabase = createClient()
  const { profile } = useAuth()
  const [votes,   setVotes]   = useState<PollVote[]>([])
  const [loading, setLoading] = useState(true)
  const [voting,  setVoting]  = useState(false)

  const options: PollOption[] = poll.poll_options ?? []

  const [expandedOption, setExpandedOption] = useState<string | null>(null)
  const mountIdRef = useRef(crypto.randomUUID())

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('poll_votes')
      .select('*, voter:profiles!user_id(id, username, full_name, avatar_url)')
      .eq('poll_id', poll.id)

    if (data) setVotes(data as PollVote[])
    setLoading(false)
  }, [supabase, poll.id])

  useEffect(() => { void load() }, [load])

  // Realtime vote updates
  useEffect(() => {
    const ch = supabase
      .channel(`poll:${poll.id}-${mountIdRef.current}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'poll_votes',
        filter: `poll_id=eq.${poll.id}`,
      }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          // fetch with join
          const { data } = await supabase
            .from('poll_votes')
            .select('*, voter:profiles!user_id(id, username, full_name, avatar_url)')
            .eq('poll_id', (payload.new as any).poll_id)
            .eq('option_id', (payload.new as any).option_id)
            .eq('user_id', (payload.new as any).user_id)
            .single()
          if (data) setVotes(prev => [...prev, data as PollVote])
        } else if (payload.eventType === 'DELETE') {
          const old = payload.old as PollVote
          setVotes(prev => prev.filter(v =>
            !(v.poll_id === old.poll_id && v.option_id === old.option_id && v.user_id === old.user_id)
          ))
        }
      })
      .subscribe()

    return () => { void supabase.removeChannel(ch) }
  }, [supabase, poll.id])

  async function handleVote(optionId: string) {
    if (voting) return
    const alreadyVoted = votes.some(v => v.option_id === optionId && v.user_id === currentUserId)

    setVoting(true)
    try {
      if (alreadyVoted) {
        // unvote
        setVotes(prev => prev.filter(v => !(v.option_id === optionId && v.user_id === currentUserId)))
        await supabase.from('poll_votes').delete()
          .eq('poll_id', poll.id).eq('option_id', optionId).eq('user_id', currentUserId)
      } else {
        // if single choice, remove previous vote from same poll first
        if (!poll.allows_multiple) {
          const prevVote = votes.find(v => v.user_id === currentUserId)
          if (prevVote) {
            setVotes(prev => prev.filter(v => !(v.user_id === currentUserId)))
            await supabase.from('poll_votes').delete()
              .eq('poll_id', poll.id).eq('user_id', currentUserId)
          }
        }
        const newVote: PollVote = {
          poll_id:    poll.id,
          option_id:  optionId,
          user_id:    currentUserId,
          created_at: new Date().toISOString(),
          voter: profile ? {
            id:         profile.id,
            username:   profile.username,
            full_name:  profile.full_name  ?? null,
            avatar_url: profile.avatar_url ?? null,
          } : undefined,
        }
        setVotes(prev => [...prev, newVote])
        await supabase.from('poll_votes').insert({ poll_id: poll.id, option_id: optionId, user_id: currentUserId })
      }
    } finally {
      setVoting(false)
    }
  }

  const totalVotes = votes.length
  const myVotedOptionIds = new Set(votes.filter(v => v.user_id === currentUserId).map(v => v.option_id))

  return (
    <div className="rounded-xl border border-surface-3 bg-white overflow-hidden max-w-sm">
      {/* Header */}
      <div className="flex items-start gap-2.5 px-4 pt-4 pb-3 border-b border-surface-2">
        <div className="w-7 h-7 rounded-lg bg-brand-faint flex items-center justify-center flex-shrink-0 mt-0.5">
          <BarChart2 size={14} className="text-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-ink text-sm leading-snug">{poll.question}</p>
          <p className="text-[11px] text-ink-4 mt-0.5">
            {poll.allows_multiple ? 'Multiple choice' : 'Single choice'}
            {poll.is_anonymous && ' · Anonymous'}
          </p>
        </div>
      </div>

      {/* Options */}
      <div className="p-3 space-y-2">
        {loading ? (
          <div className="space-y-2 animate-pulse">
            {options.map(o => <div key={o.id} className="h-10 rounded-lg bg-surface" />)}
          </div>
        ) : options.map(opt => {
          const optVoters = votes.filter(v => v.option_id === opt.id) as PollVote[]
          const optVotes  = optVoters.length
          const pct       = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0
          const isMine    = myVotedOptionIds.has(opt.id)
          const isExpanded = expandedOption === opt.id
          const showVoters = !poll.is_anonymous && optVotes > 0

          return (
            <div key={opt.id} className="space-y-1">
              <button type="button" onClick={() => void handleVote(opt.id)}
                disabled={voting}
                className={cn(
                  'relative w-full rounded-lg overflow-hidden transition-all text-left',
                  'border focus:outline-none focus:ring-2 focus:ring-brand/20',
                  isMine ? 'border-brand' : 'border-surface-3 hover:border-brand/40'
                )}
              >
                {/* Progress bar */}
                <div
                  className={cn('absolute inset-y-0 left-0 transition-all duration-500',
                    isMine ? 'bg-brand/10' : 'bg-surface')}
                  style={{ width: `${pct}%` }}
                />
                <div className="relative flex items-center gap-2.5 px-3 py-2.5">
                  {/* Check circle */}
                  <div className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                    isMine ? 'border-brand bg-brand' : 'border-gray-300'
                  )}>
                    {isMine && <Check size={11} className="text-white" strokeWidth={3} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm', isMine ? 'font-semibold text-brand-dark' : 'text-ink')}>
                      {opt.text}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className={cn('text-sm font-bold', isMine ? 'text-brand' : 'text-ink-3')}>{pct}%</p>
                    <p className="text-[10px] text-ink-4 leading-none">{optVotes} vote{optVotes !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              </button>

              {/* Voter list — toggle on click */}
              {showVoters && (
                <div className="px-1">
                  <button
                    type="button"
                    onClick={() => setExpandedOption(isExpanded ? null : opt.id)}
                    className="flex items-center gap-1.5 text-[11px] text-ink-4 hover:text-ink-2 transition-colors"
                  >
                    {/* Stacked avatars preview */}
                    <div className="flex -space-x-1.5">
                      {optVoters.slice(0, 4).map((v, i) => (
                        <div key={i}
                          className="w-4 h-4 rounded-full border border-white bg-brand-faint
                                     flex items-center justify-center text-[8px] font-bold text-brand overflow-hidden"
                          title={v.voter?.full_name ?? v.voter?.username ?? '?'}
                        >
                          {v.voter?.avatar_url
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={v.voter.avatar_url} alt="" className="w-full h-full object-cover" />
                            : (v.voter?.username?.[0] ?? '?').toUpperCase()
                          }
                        </div>
                      ))}
                    </div>
                    <span>
                      {optVoters.slice(0, 2).map(v => v.voter?.full_name ?? v.voter?.username ?? '?').join(', ')}
                      {optVoters.length > 2 && ` +${optVoters.length - 2} more`}
                    </span>
                    {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                  </button>

                  {/* Expanded voter list */}
                  {isExpanded && (
                    <div className="mt-1.5 pl-1 space-y-1">
                      {optVoters.map((v, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-brand-faint flex items-center justify-center
                                          text-[9px] font-bold text-brand overflow-hidden flex-shrink-0">
                            {v.voter?.avatar_url
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={v.voter.avatar_url} alt="" className="w-full h-full object-cover" />
                              : (v.voter?.username?.[0] ?? '?').toUpperCase()
                            }
                          </div>
                          <span className="text-xs text-ink-2">
                            {v.voter?.full_name ?? v.voter?.username ?? 'Unknown'}
                          </span>
                          {v.user_id === currentUserId && (
                            <span className="text-[10px] text-brand font-medium">(you)</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="px-4 pb-3 text-[11px] text-ink-4">
        {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
        {poll.allows_multiple && ' · Select all that apply'}
      </div>
    </div>
  )
}
