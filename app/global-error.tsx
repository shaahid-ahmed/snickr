'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body style={{ fontFamily: 'monospace', padding: '2rem', background: '#fff' }}>
        <h2 style={{ color: '#dc2626' }}>Something went wrong</h2>
        <pre style={{
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: '8px',
          padding: '1rem',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          fontSize: '13px',
          color: '#991b1b',
        }}>
          {error?.message ?? 'Unknown error'}
          {'\n\n'}
          {error?.stack ?? ''}
        </pre>
        {error?.digest && (
          <p style={{ fontSize: '12px', color: '#6b7280' }}>Digest: {error.digest}</p>
        )}
        <button
          onClick={reset}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1.5rem',
            background: '#4f46e5',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
