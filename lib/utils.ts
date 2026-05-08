import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now  = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / 86_400_000)

  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return date.toLocaleDateString([], { month: 'long', day: 'numeric' })
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}
