import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './features/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT:  '#9DC183',  // pistachio
          dark:     '#6B9E52',
          darker:   '#4A7A35',
          light:    '#C2DBA8',
          lighter:  '#D4E9C4',
          faint:    '#F3F8EF',
        },
        surface: {
          DEFAULT:  '#F7F9F5',
          2:        '#EEF3EA',
          3:        '#E4EDE0',
        },
        ink: {
          DEFAULT:  '#1C1F1A',
          2:        '#3A3D38',
          3:        '#6B6E69',
          4:        '#9BA89A',
        },
        sidebar: {
          bg:       '#1C2B1A',   // deep dark green
          hover:    '#243623',
          active:   '#2D4430',
          border:   '#2A3D28',
          text:     '#B8CDB5',
          muted:    '#6B8A68',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '8px',
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          from: { transform: 'translateX(-8px)', opacity: '0' },
          to:   { transform: 'translateX(0)',    opacity: '1' },
        },
        'emoji-pop': {
          '0%':   { transform: 'scale(0.3)', opacity: '0' },
          '50%':  { transform: 'scale(1.25)', opacity: '1' },
          '75%':  { transform: 'scale(0.92)' },
          '100%': { transform: 'scale(1)',   opacity: '1' },
        },
        'emoji-float': {
          '0%':   { opacity: '1', transform: 'translateY(0) scale(1)' },
          '100%': { opacity: '0', transform: 'translateY(-90px) scale(0.5)' },
        },
        'reaction-pop': {
          '0%':   { transform: 'scale(1)' },
          '40%':  { transform: 'scale(1.35)' },
          '100%': { transform: 'scale(1)' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to:   { transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in':        'fade-in 0.15s ease-out',
        'slide-in':       'slide-in 0.15s ease-out',
        'emoji-pop':      'emoji-pop 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        'emoji-float':    'emoji-float 1.1s ease-out forwards',
        'reaction-pop':   'reaction-pop 0.25s ease-out',
        'slide-in-right': 'slide-in-right 0.22s ease-out',
      },
    },
  },
  plugins: [],
}

export default config