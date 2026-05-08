'use client'

import { useEffect, useState } from 'react'
import { Download, ExternalLink, FileText, Image, Loader2, X } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { useChannelMedia } from '@/hooks/useChannelMedia'
import { formatDate } from '@/lib/utils'
import type { MediaItem } from '@/types'

interface MediaPanelProps {
  channelId?:      string
  conversationId?: string
  title:           string
  onClose:         () => void
}

type TabId = 'media' | 'files'

// ── helpers ────────────────────────────────────────────────────────────────

function isImageOrVideo(mime: string) {
  return mime.startsWith('image/') || mime.startsWith('video/')
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024)       return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function monthLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function groupByMonth<T extends { msg_created_at: string }>(items: T[]) {
  const groups: { label: string; items: T[] }[] = []
  let current = ''
  for (const item of items) {
    const label = monthLabel(item.msg_created_at)
    if (label !== current) {
      groups.push({ label, items: [] })
      current = label
    }
    groups[groups.length - 1].items.push(item)
  }
  return groups
}

// ── Main component ─────────────────────────────────────────────────────────

export function MediaPanel({ channelId, conversationId, title, onClose }: MediaPanelProps) {
  const [tab, setTab] = useState<TabId>('media')
  const [lightbox, setLightbox] = useState<MediaItem | null>(null)

  const { items, loading, hasMore, reload, loadMore } = useChannelMedia({
    channelId,
    conversationId,
  })

  // Load on mount / when channel changes
  useEffect(() => { reload() }, [reload])

  const mediaItems = items.filter(i => isImageOrVideo(i.mime_type))
  const fileItems  = items.filter(i => !isImageOrVideo(i.mime_type))
  const tabItems   = tab === 'media' ? mediaItems : fileItems

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-80 bg-white shadow-2xl
                      flex flex-col animate-slide-in-right overflow-hidden">

        {/* Header */}
        <div className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="font-semibold text-ink text-sm">Media &amp; Files</h2>
            <p className="text-xs text-ink-4 truncate max-w-[220px]">{title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-ink-4 hover:bg-surface transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b flex-shrink-0">
          <TabBtn id="media" active={tab === 'media'} onClick={() => setTab('media')}
            label={`Media (${mediaItems.length}${hasMore ? '+' : ''})`}
            icon={<Image size={13} />} />
          <TabBtn id="files" active={tab === 'files'} onClick={() => setTab('files')}
            label={`Files (${fileItems.length}${hasMore ? '+' : ''})`}
            icon={<FileText size={13} />} />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 size={20} className="animate-spin text-brand" />
            </div>
          ) : tabItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-ink-4">
              {tab === 'media'
                ? <><Image size={28} strokeWidth={1.5} /><p className="text-sm">No images or videos yet</p></>
                : <><FileText size={28} strokeWidth={1.5} /><p className="text-sm">No files shared yet</p></>
              }
            </div>
          ) : tab === 'media' ? (
            <MediaGrid groups={groupByMonth(mediaItems)} onSelect={setLightbox} />
          ) : (
            <FileList groups={groupByMonth(fileItems)} />
          )}

          {/* Load more */}
          {hasMore && !loading && (
            <div className="py-3 flex justify-center">
              <button
                onClick={loadMore}
                className="text-xs text-brand-dark hover:underline"
              >
                Load more
              </button>
            </div>
          )}
          {loading && items.length > 0 && (
            <div className="py-3 flex justify-center">
              <Loader2 size={16} className="animate-spin text-brand" />
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <Lightbox item={lightbox} onClose={() => setLightbox(null)} />
      )}
    </>
  )
}

// ── Tab button ─────────────────────────────────────────────────────────────

function TabBtn({ id, active, onClick, label, icon }: {
  id: TabId; active: boolean; onClick: () => void; label: string; icon: React.ReactNode
}) {
  return (
    <button
      key={id}
      onClick={onClick}
      className={[
        'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors',
        active
          ? 'border-brand text-brand'
          : 'border-transparent text-ink-4 hover:text-ink',
      ].join(' ')}
    >
      {icon}{label}
    </button>
  )
}

// ── Media grid ─────────────────────────────────────────────────────────────

function MediaGrid({
  groups,
  onSelect,
}: {
  groups: { label: string; items: MediaItem[] }[]
  onSelect: (item: MediaItem) => void
}) {
  return (
    <div className="p-3 space-y-4">
      {groups.map(g => (
        <section key={g.label}>
          <p className="text-[11px] font-semibold text-ink-4 uppercase tracking-wider mb-2">
            {g.label}
          </p>
          <div className="grid grid-cols-3 gap-1">
            {g.items.map(item => (
              <button
                key={item.id}
                onClick={() => onSelect(item)}
                className="aspect-square rounded-lg overflow-hidden bg-surface-2
                           hover:opacity-90 transition-opacity focus:outline-none
                           focus:ring-2 focus:ring-brand group relative"
                title={item.name}
              >
                {item.mime_type.startsWith('image/') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.url}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  /* Video thumbnail placeholder */
                  <div className="w-full h-full flex items-center justify-center bg-ink-2 text-white">
                    <span className="text-2xl">▶</span>
                  </div>
                )}
                {/* Sender hover overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100
                                transition-opacity flex flex-col justify-end p-1.5">
                  <p className="text-white text-[10px] font-medium leading-tight truncate">
                    {item.sender_full_name ?? item.sender_username}
                  </p>
                  <p className="text-white/70 text-[9px] leading-tight">
                    {formatDate(item.msg_created_at)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

// ── File list ──────────────────────────────────────────────────────────────

function FileList({ groups }: { groups: { label: string; items: MediaItem[] }[] }) {
  return (
    <div className="p-3 space-y-4">
      {groups.map(g => (
        <section key={g.label}>
          <p className="text-[11px] font-semibold text-ink-4 uppercase tracking-wider mb-2">
            {g.label}
          </p>
          <div className="space-y-1">
            {g.items.map(item => (
              <FileRow key={item.id} item={item} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function FileRow({ item }: { item: MediaItem }) {
  const ext = item.name.split('.').pop()?.toUpperCase() ?? 'FILE'

  return (
    <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-surface transition-colors group">
      {/* File type icon */}
      <div className="w-9 h-9 rounded-lg bg-brand-faint flex flex-col items-center
                      justify-center flex-shrink-0 border border-brand/20">
        <span className="text-[9px] font-bold text-brand-dark leading-none">{ext}</span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-ink truncate">{item.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Avatar
            src={item.sender_avatar_url}
            username={item.sender_username}
            size="xs"
          />
          <span className="text-[10px] text-ink-4 truncate">
            {item.sender_full_name ?? item.sender_username}
          </span>
          {item.size_bytes && (
            <span className="text-[10px] text-ink-4">· {formatBytes(item.size_bytes)}</span>
          )}
        </div>
        <p className="text-[10px] text-ink-4 mt-0.5">{formatDate(item.msg_created_at)}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          title="Open"
          className="p-1 rounded text-ink-4 hover:text-brand hover:bg-surface transition-colors"
        >
          <ExternalLink size={13} />
        </a>
        <a
          href={item.url}
          download={item.name}
          title="Download"
          className="p-1 rounded text-ink-4 hover:text-brand hover:bg-surface transition-colors"
        >
          <Download size={13} />
        </a>
      </div>
    </div>
  )
}

// ── Lightbox ───────────────────────────────────────────────────────────────

function Lightbox({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/85 flex flex-col items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Toolbar */}
      <div
        className="absolute top-4 right-4 flex items-center gap-2"
        onClick={e => e.stopPropagation()}
      >
        <a
          href={item.url}
          download={item.name}
          className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
          title="Download"
        >
          <Download size={16} />
        </a>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
          title="Open in new tab"
        >
          <ExternalLink size={16} />
        </a>
        <button
          onClick={onClose}
          className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Image */}
      {item.mime_type.startsWith('image/') ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.url}
          alt={item.name}
          className="max-w-full max-h-[80vh] rounded-lg object-contain shadow-2xl"
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <video
          src={item.url}
          controls
          className="max-w-full max-h-[80vh] rounded-lg shadow-2xl"
          onClick={e => e.stopPropagation()}
        />
      )}

      {/* Caption */}
      <div
        className="mt-3 flex items-center gap-2 text-white/70 text-xs"
        onClick={e => e.stopPropagation()}
      >
        <Avatar
          src={item.sender_avatar_url}
          username={item.sender_username}
          size="xs"
        />
        <span>{item.sender_full_name ?? item.sender_username}</span>
        <span>·</span>
        <span>{item.name}</span>
        <span>·</span>
        <span>{formatDate(item.msg_created_at)}</span>
      </div>
    </div>
  )
}
