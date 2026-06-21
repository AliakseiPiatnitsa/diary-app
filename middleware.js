import { NextResponse } from 'next/server'

export async function middleware(request) {
  const { pathname } = request.nextUrl

  // Supabase хранит сессию в cookie с паттерном sb-*-auth-token
  // Проверяем его наличие без вызова Supabase SDK (SDK не работает в Edge Runtime)
  const cookies = request.cookies.getAll()
  const hasSession = cookies.some(
    c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
  )

  // Не залогинен и пытается открыть /journal → на /login
  if (!hasSession && pathname.startsWith('/journal')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Уже залогинен и открывает /login → на /journal
  if (hasSession && pathname === '/login') {
    return NextResponse.redirect(new URL('/journal', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
