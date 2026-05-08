import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const safeUrl = SUPABASE_URL?.startsWith('http') ? SUPABASE_URL : 'https://placeholder.supabase.co'

export async function middleware(request: NextRequest) {
  // If env vars aren't configured, skip auth gating so the build succeeds
  if (!SUPABASE_URL?.startsWith('http')) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    safeUrl,
    SUPABASE_ANON_KEY || 'placeholder-anon-key',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — must not have any logic between createServerClient and getUser
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isAuthRoute  = pathname.startsWith('/login') || pathname.startsWith('/signup')
  const isAppRoute   = !isAuthRoute && pathname !== '/' && pathname !== '/auth/callback' && !pathname.startsWith('/invite')

  // Not logged in trying to access app → send to login
  if (!user && isAppRoute) {
    const url = new URL('/login', request.url)
    url.searchParams.set('returnTo', pathname)
    return NextResponse.redirect(url)
  }

  // Logged in trying to access auth pages → send to returnTo path or root
  if (user && isAuthRoute) {
    const returnTo = request.nextUrl.searchParams.get('returnTo')
    if (returnTo) {
      return NextResponse.redirect(new URL(returnTo, request.url))
    }
    return NextResponse.redirect(new URL('/', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
