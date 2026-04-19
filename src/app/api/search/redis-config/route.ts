import { NextResponse } from 'next/server';
import { chatRedis } from '@/lib/chatRedis';

/** 클라이언트가 탐색 전에 Upstash 구성 여부를 확인할 때 사용 */
export async function GET(): Promise<NextResponse<{ redisConfigured: boolean }>> {
  return NextResponse.json({ redisConfigured: chatRedis !== null });
}
