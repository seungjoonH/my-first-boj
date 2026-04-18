import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// UUID 발급은 /api/chat/init 에서만 수행한다.
// 미들웨어가 먼저 새 UUID를 발급하면 X-Chat-Restore 경로가 차단된다.

export function middleware(req: NextRequest): NextResponse {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.svg).*)'],
};
