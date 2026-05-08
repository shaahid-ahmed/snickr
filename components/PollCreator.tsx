'use client'

import { useRef, useState } from 'react'
import { BarChart2, Minus, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PollCreatorProps {
  onSubmit: (question: string, options: string[], allowsMultiple: boolean, isAnonymous: boolean) => void
  onCancel: () => void
}

export function PollCreator({ onSubmit, onCancel }: PollCreatorProps) {
  const [question,       setQuestion]       = useState('')
  const [options,        setOptions]        = useState(['', ''])
  const [allowsMultiple, setAllowsMultiple] = useState(false)
  const [isAnonymous,    setIsAnonymous]    = useState(false)
  const questionRef = useRef<HTMLInputElement>(null)

  function updateOption(i: number, val: string) {
    setOptions(prev => prev.map((o, idx) => idx === i ? val : o))
  }

  function addOption() {
    if (options.length < 6) setOptions(prev => [...prev, ''])
  }

  function removeOption(i: number) {
    if (options.length > 2) setOptions(prev => prev.filter((_, idx) => idx !== i))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = question.trim()
    const opts = options.map(o => o.trim()).filter(Boolean)
    if (!q || opts.length < 2) return
    onSubmit(q, opts, allowsMultiple, isAnonymous)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-3">
          <div className="w-8 h-8 rounded-lg bg-brand-faint flex items-center justify-center">
            <BarChart2 size={16} className="text-brand" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-ink text-sm">Create a poll</h2>
            <p className="text-xs text-ink-4">Ask your team a question</p>
          </div>
          <button onClick={onCancel}
            className="p-1 rounded-md text-ink-4 hover:text-ink hover:bg-surface transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Question */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-3 uppercase tracking-wide">Question</label>
            <input
              ref={questionRef}
              autoFocus
              type="text"
              placeholder="What do you want to ask?"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              className="w-full rounded-lg border border-surface-3 px-3 py-2 text-sm text-ink
                         placeholder:text-ink-4 focus:outline-none focus:ring-2 focus:ring-brand/20
                         focus:border-brand transition-all"
              maxLength={200}
            />
          </div>

          {/* Options */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-3 uppercase tracking-wide">
              Options <span className="normal-case font-normal text-ink-4">({options.length}/6)</span>
            </label>
            <div className="space-y-2">
              {options.map((opt, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <span className="w-5 h-5 rounded-full bg-surface flex items-center justify-center
                                   text-[10px] font-bold text-ink-4 flex-shrink-0">
                    {i + 1}
                  </span>
                  <input
                    type="text"
                    placeholder={`Option ${i + 1}`}
                    value={opt}
                    onChange={e => updateOption(i, e.target.value)}
                    className="flex-1 rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink
                               placeholder:text-ink-4 focus:outline-none focus:ring-2 focus:ring-brand/20
                               focus:border-brand transition-all"
                    maxLength={100}
                  />
                  <button type="button" onClick={() => removeOption(i)}
                    disabled={options.length <= 2}
                    className="p-1 rounded-md text-ink-4 hover:text-red-500 hover:bg-red-50
                               transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0">
                    <Minus size={15} />
                  </button>
                </div>
              ))}
            </div>
            {options.length < 6 && (
              <button type="button" onClick={addOption}
                className="flex items-center gap-1.5 text-xs text-brand hover:text-brand-dark
                           font-medium transition-colors mt-1">
                <Plus size={13} /> Add option
              </button>
            )}
          </div>

          {/* Settings */}
          <div className="rounded-xl border border-surface-3 divide-y divide-surface-3">
            <label className="flex items-center justify-between px-4 py-3 cursor-pointer">
              <div>
                <p className="text-sm font-medium text-ink">Multiple choice</p>
                <p className="text-xs text-ink-4">Allow selecting more than one option</p>
              </div>
              <div className={cn('relative w-10 rounded-full transition-colors', allowsMultiple ? 'bg-brand' : 'bg-gray-200')}
                style={{ height: '1.375rem' }}
                onClick={() => setAllowsMultiple(v => !v)}>
                <span className={cn('absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform',
                  allowsMultiple ? 'translate-x-4' : 'translate-x-0')} />
              </div>
            </label>
            <label className="flex items-center justify-between px-4 py-3 cursor-pointer">
              <div>
                <p className="text-sm font-medium text-ink">Anonymous votes</p>
                <p className="text-xs text-ink-4">Hide who voted for what</p>
              </div>
              <div className={cn('relative w-10 rounded-full transition-colors', isAnonymous ? 'bg-brand' : 'bg-gray-200')}
                style={{ height: '1.375rem' }}
                onClick={() => setIsAnonymous(v => !v)}>
                <span className={cn('absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform',
                  isAnonymous ? 'translate-x-4' : 'translate-x-0')} />
              </div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onCancel}
              className="flex-1 py-2 rounded-lg border border-surface-3 text-sm text-ink-3
                         hover:bg-surface transition-colors font-medium">
              Cancel
            </button>
            <button type="submit"
              disabled={!question.trim() || options.filter(o => o.trim()).length < 2}
              className="flex-1 py-2 rounded-lg bg-brand text-white text-sm font-medium
                         hover:bg-brand-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              Create poll
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
