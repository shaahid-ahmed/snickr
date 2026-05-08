import Image from 'next/image'
import { cn } from '@/lib/utils'

type Size = 'xs' | 'sm' | 'md' | 'lg'

interface AvatarProps {
  src?: string | null
  username: string
  size?: Size
  className?: string
  showStatus?: boolean
  status?: 'available' | 'busy' | 'away'
  isDnd?: boolean
}

const sizeMap: Record<Size, { wrapper: string; text: string; dot: string }> = {
  xs: { wrapper: 'w-6 h-6',   text: 'text-[10px]', dot: 'w-2 h-2 border' },
  sm: { wrapper: 'w-8 h-8',   text: 'text-xs',     dot: 'w-2.5 h-2.5 border' },
  md: { wrapper: 'w-9 h-9',   text: 'text-sm',     dot: 'w-3 h-3 border-[1.5px]' },
  lg: { wrapper: 'w-11 h-11', text: 'text-base',   dot: 'w-3.5 h-3.5 border-2' },
}

const statusColor: Record<string, string> = {
  available: 'bg-green-400',
  busy:      'bg-yellow-400',
  away:      'bg-gray-400',
}

export function Avatar({
  src,
  username,
  size = 'md',
  className,
  showStatus,
  status = 'available',
  isDnd,
}: AvatarProps) {
  const { wrapper, text, dot } = sizeMap[size]
  const initials = username.slice(0, 2).toUpperCase()

  return (
    <div className={cn('relative flex-shrink-0', wrapper, className)}>
      {src ? (
        <Image
          src={src}
          alt={username}
          fill
          className="rounded-lg object-cover"
          sizes="44px"
        />
      ) : (
        <div
          className={cn(
            'w-full h-full rounded-lg bg-brand-dark flex items-center justify-center',
            text
          )}
        >
          <span className="font-semibold text-white select-none">{initials}</span>
        </div>
      )}

      {showStatus && (
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 rounded-full border-sidebar-bg',
            dot,
            isDnd ? 'bg-slate-500' : statusColor[status]
          )}
        />
      )}
    </div>
  )
}
