import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has('nc_session');
  
  if (hasSession && req.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/profile', req.url));
  }
}

export const config = {
  matcher: ['/'],
};
