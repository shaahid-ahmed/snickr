'use client'

import { useEffect, useRef } from 'react'
import data from '@emoji-mart/data'
import Picker from '@emoji-mart/react'

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  onClose:  () => void
  /** Tailwind / inline positioning classes for the popover */
  className?: string
}

/**
 * Full emoji-mart picker in a click-away-dismissible popover.
 * Renders above the trigger by default (bottom-full).
 */
export function EmojiPickerPopover({ onSelect, onClose, className = '' }: EmojiPickerProps) {
  const ref = useRef<HTMLDivElement>(null)

  // Close when clicking outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    // slight delay so the opener click doesn't immediately close
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => {
      clearTimeout(id)
      document.removeEventListener('mousedown', handler)
    }
  }, [onClose])

  // Also close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className={`absolute z-50 shadow-xl rounded-xl overflow-hidden animate-fade-in ${className}`}
      // Prevent the parent form / hover effects from firing
      onMouseDown={e => e.stopPropagation()}
    >
      <Picker
        data={data}
        onEmojiSelect={(em: { native: string }) => {
          onSelect(em.native)
          onClose()
        }}
        theme="light"
        previewPosition="none"
        skinTonePosition="search"
        maxFrequentRows={2}
        perLine={8}
        emojiSize={22}
        emojiButtonSize={32}
      />
    </div>
  )
}
