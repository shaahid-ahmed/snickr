'use client'

import { useEffect, useRef, useState } from 'react'
import { FileText, Lock, Send, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AttachmentPreviewProps {
  file:     File
  onSend:   (caption: string, isRestricted: boolean) => void
  onCancel: () => void
}

function formatBytes(n: number) {
  if (n < 1024)       return `${n} B`
  if (n < 1024 ** 2)  return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 ** 2).toFixed(1)} MB`
}

export function AttachmentPreview({ file, onSend, onCancel }: AttachmentPreviewProps) {
  const [caption,      setCaption]      = useState('')
  const [isRestricted, setIsRestricted] = useState(false)
  const [preview,      setPreview]      = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isImage = file.type.startsWith('image/')
  const isVideo = file.type.startsWith('video/')

  useEffect(() => {
    if (isImage || isVideo) {
      const url = URL.createObjectURL(file)
      setPreview(url)
      return () => URL.revokeObjectURL(url)
    }
  }, [file, isImage, isVideo])

  useEffect(() => {
    // focus caption input when modal opens
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend(caption, isRestricted)
    }
    if (e.key === 'Escape') onCancel()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-3">
          <span className="text-sm font-semibold text-ink">Send file</span>
          <button onClick={onCancel} className="p-1 rounded-md text-ink-4 hover:text-ink hover:bg-surface transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Preview area */}
        <div className="bg-surface-faint flex items-center justify-center min-h-48 p-4">
          {isImage && preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={file.name}
              className="max-h-64 max-w-full rounded-lg object-contain shadow-sm" />
          ) : isVideo && preview ? (
            <video src={preview} controls className="max-h-64 max-w-full rounded-lg shadow-sm" />
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-brand-faint flex items-center justify-center">
                <FileText size={32} className="text-brand" />
              </div>
              <p className="text-sm font-medium text-ink text-center max-w-xs truncate">{file.name}</p>
              <p className="text-xs text-ink-4">{formatBytes(file.size)}</p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 space-y-3">
          {/* File name + size */}
          <div className="flex items-center gap-2 text-xs text-ink-4">
            <span className="truncate font-medium text-ink-2">{file.name}</span>
            <span className="flex-shrink-0">· {formatBytes(file.size)}</span>
          </div>

          {/* Caption input */}
          <input
            ref={inputRef}
            type="text"
            placeholder="Add a caption (optional)"
            value={caption}
            onChange={e => setCaption(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full rounded-lg border border-surface-3 bg-white px-3 py-2 text-sm
                       text-ink placeholder:text-ink-4 focus:outline-none
                       focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all"
          />

          {/* Restrict toggle */}
          <label className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors',
            isRestricted
              ? 'border-amber-300 bg-amber-50'
              : 'border-surface-3 bg-white hover:bg-surface'
          )}>
            <input type="checkbox" className="hidden"
              checked={isRestricted} onChange={e => setIsRestricted(e.target.checked)} />
            <div className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
              isRestricted ? 'bg-amber-100 text-amber-600' : 'bg-surface text-ink-4'
            )}>
              <Lock size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn('text-sm font-medium', isRestricted ? 'text-amber-800' : 'text-ink')}>
                Restrict access
              </p>
              <p className={cn('text-xs', isRestricted ? 'text-amber-600' : 'text-ink-4')}>
                Recipients can view but not download or share
              </p>
            </div>
            <div className={cn(
              'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
              isRestricted ? 'border-amber-500 bg-amber-500' : 'border-gray-300'
            )}>
              {isRestricted && <span className="w-2 h-2 rounded-full bg-white" />}
            </div>
          </label>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button onClick={onCancel}
              className="flex-1 py-2 rounded-lg border border-surface-3 text-sm text-ink-3
                         hover:bg-surface transition-colors font-medium">
              Cancel
            </button>
            <button onClick={() => onSend(caption, isRestricted)}
              className="flex-1 py-2 rounded-lg bg-brand text-white text-sm font-medium
                         hover:bg-brand-dark transition-colors flex items-center justify-center gap-2">
              <Send size={15} />
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
