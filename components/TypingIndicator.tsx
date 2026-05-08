import type { TypingUser } from '@/hooks/useTyping'

interface TypingIndicatorProps {
  typingUsers: TypingUser[]
}

export function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
  if (typingUsers.length === 0) return null

  const text =
    typingUsers.length === 1
      ? `${typingUsers[0].username} is typing`
      : typingUsers.length === 2
      ? `${typingUsers[0].username} and ${typingUsers[1].username} are typing`
      : `${typingUsers[0].username} and ${typingUsers.length - 1} others are typing`

  return (
    <div className="px-5 py-1 flex items-center gap-2 h-6 flex-shrink-0">
      {/* Animated dots */}
      <span className="flex items-center gap-[3px]">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-[5px] h-[5px] rounded-full bg-ink-4 animate-bounce"
            style={{ animationDelay: `${i * 160}ms`, animationDuration: '1s' }}
          />
        ))}
      </span>
      <span className="text-xs text-ink-4 italic">{text}…</span>
    </div>
  )
}
