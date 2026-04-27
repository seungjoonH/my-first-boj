import { chatRedis } from '@/lib/chatRedis';
import { SERVICE_END_MS_DEFAULT } from '@/lib/constants';

/** Upstash: 서비스 종료 시각(ms) 오버라이드. 없으면 `SERVICE_END_MS_DEFAULT` */
export const SERVICE_END_CONFIG_KEY = 'config:service_end_ms';

/**
 * Redis에 `SERVICE_END_CONFIG_KEY`가 있으면 그 ms, 없거나 잘못되면
 * `constants` 기본값.
 */
export async function getServiceEndMs(): Promise<number> {
  if (!chatRedis) return SERVICE_END_MS_DEFAULT;
  const raw = await chatRedis.get(SERVICE_END_CONFIG_KEY);
  if (raw == null || raw === '') return SERVICE_END_MS_DEFAULT;
  const n = Number(typeof raw === 'string' ? raw : String(raw));
  if (!Number.isFinite(n) || n <= 0) return SERVICE_END_MS_DEFAULT;
  return Math.floor(n);
}
