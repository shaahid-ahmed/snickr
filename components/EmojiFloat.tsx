'use client'

import { useEffect, useState } from 'react'

// Fixed particle trajectories — deterministic, no hydration issues
const PARTICLES = [
  { offsetX: -50, delay: 0.00, dur: 1.10 },
  { offsetX: -30, delay: 0.07, dur: 0.95 },
  { offsetX: -10, delay: 0.14, dur: 1.20 },
  { offsetX:  10, delay: 0.05, dur: 1.05 },
  { offsetX:  30, delay: 0.11, dur: 1.15 },
  { offsetX:  50, delay: 0.02, dur: 0.90 },
  { offsetX: -20, delay: 0.18, dur: 1.00 },
  { offsetX:  20, delay: 0.09, dur: 1.25 },
]

interface EmojiFloatProps {
  emoji: string
  /** Run the float animation on mount (e.g. freshly sent message) */
  animate?: boolean
}

/**
 * Renders a single large emoji.
 * When `animate` is true a burst of floating copies rises and fades above it.
 */
export function EmojiFloat({ emoji, animate = false }: EmojiFloatProps) {
  const [showParticles, setShowParticles] = useState(animate)

  // Stop rendering particles after longest animation completes (~1.5 s)
  useEffect(() => {
    if (!animate) return
    setShowParticles(true)
    const t = setTimeout(() => setShowParticles(false), 1600)
    return () => clearTimeout(t)
  }, [animate])

  return (
    <span className="relative inline-block select-none leading-none">
      {/* Main large emoji */}
      <span
        className="text-6xl animate-emoji-pop inline-block"
        role="img"
        aria-label={emoji}
      >
        {emoji}
      </span>

      {/* Floating particles */}
      {showParticles && PARTICLES.map((p, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="pointer-events-none absolute text-2xl animate-emoji-float"
          style={{
            bottom: '50%',
            left: `calc(50% + ${p.offsetX}px)`,
            transform: 'translateX(-50%)',
            animationDelay:    `${p.delay}s`,
            animationDuration: `${p.dur}s`,
          }}
        >
          {emoji}
        </span>
      ))}
    </span>
  )
}
