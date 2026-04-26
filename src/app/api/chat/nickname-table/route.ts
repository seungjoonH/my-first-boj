import { isReservedChatUuid } from '@/lib/chatAdmin';
import { computeNicknameGridCoords } from '@/lib/chatNickname';
import { rebuildNicknameTableSnapshot } from '@/lib/chatNicknameTableAggregate';
import {
  chatRedis,
  getEffectiveSalt,
  nickTableRebuildLockKey,
  nickTableSnapshotKey,
  nickTableVerKey,
} from '@/lib/chatRedis';
import { resolveChatViewerContext } from '@/lib/chatIdentityRequest';
import type { NicknameTableApiResponse, NicknameTableSnapshot } from '@/types/chatNicknameTable';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseSnapshot(raw: unknown): NicknameTableSnapshot | null {
  if (typeof raw !== 'string') return null;
  try {
    const v = JSON.parse(raw) as NicknameTableSnapshot;
    if (
      typeof v.version === 'number' &&
      typeof v.generatedAt === 'number' &&
      Array.isArray(v.occupancy) &&
      Array.isArray(v.unlocked) &&
      typeof v.totalUnlockedCount === 'number'
    ) {
      return v;
    }
    return null;
  }
  catch {
    return null;
  }
}

async function resolveMyCell(req: Request): Promise<{ flatIndex: number; bIndex: number } | null> {
  try {
    const { uuid } = await resolveChatViewerContext(req);
    if (!uuid || isReservedChatUuid(uuid)) return null;
    const salt = await getEffectiveSalt(uuid);
    if (!salt) return null;
    return computeNicknameGridCoords(uuid, salt);
  }
  catch {
    return null;
  }
}

const REBUILD_LOCK_TTL_SEC = 90;
const REBUILD_WAIT_POLL_MS = 150;
const REBUILD_WAIT_MAX_MS = 20_000;

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isSnapshotInSync(
  verR: unknown,
  snap: NicknameTableSnapshot | null,
): snap is NicknameTableSnapshot {
  if (snap == null || verR == null) return false;
  const n = Number(String(verR));
  return Number.isFinite(n) && snap.version === n;
}

type ChatRedisClient = NonNullable<typeof chatRedis>;

async function ensureNicknameTableSnapshot(redis: ChatRedisClient): Promise<NicknameTableSnapshot | null> {
  let verRaw = await redis.get(nickTableVerKey());
  let verNum = verRaw == null ? null : Number(String(verRaw));
  let hasValidVerKey = verRaw != null && Number.isFinite(verNum);

  let snapRaw = await redis.get(nickTableSnapshotKey());
  let snapshot = parseSnapshot(snapRaw);

  if (isSnapshotInSync(verRaw, snapshot)) return snapshot;

  if (!hasValidVerKey) {
    await redis.set(nickTableVerKey(), '1');
    verRaw = await redis.get(nickTableVerKey());
    verNum = verRaw == null ? null : Number(String(verRaw));
    hasValidVerKey = verRaw != null && Number.isFinite(verNum);
    snapRaw = await redis.get(nickTableSnapshotKey());
    snapshot = parseSnapshot(snapRaw);
    if (isSnapshotInSync(verRaw, snapshot)) return snapshot;
  }

  const lockKey = nickTableRebuildLockKey();
  const waitDeadline = Date.now() + REBUILD_WAIT_MAX_MS;
  let haveLock = await redis.set(lockKey, '1', { nx: true, ex: REBUILD_LOCK_TTL_SEC });

  while (!haveLock && Date.now() < waitDeadline) {
    await sleepMs(REBUILD_WAIT_POLL_MS);
    verRaw = await redis.get(nickTableVerKey());
    verNum = verRaw == null ? null : Number(String(verRaw));
    hasValidVerKey = verRaw != null && Number.isFinite(verNum);
    snapRaw = await redis.get(nickTableSnapshotKey());
    snapshot = parseSnapshot(snapRaw);
    if (isSnapshotInSync(verRaw, snapshot)) return snapshot;
    haveLock = await redis.set(lockKey, '1', { nx: true, ex: REBUILD_LOCK_TTL_SEC });
  }

  if (isSnapshotInSync(verRaw, snapshot)) return snapshot;

  if (haveLock) {
    try {
      verRaw = await redis.get(nickTableVerKey());
      verNum = verRaw == null ? null : Number(String(verRaw));
      const vNow = verRaw != null && Number.isFinite(verNum) ? (verNum as number) : 1;
      snapRaw = await redis.get(nickTableSnapshotKey());
      snapshot = parseSnapshot(snapRaw);
      if (isSnapshotInSync(verRaw, snapshot)) return snapshot;
      return await rebuildNicknameTableSnapshot(vNow);
    }
    finally {
      await redis.del(lockKey).catch(() => {});
    }
  }

  verRaw = await redis.get(nickTableVerKey());
  verNum = verRaw == null ? null : Number(String(verRaw));
  const vFallback = verRaw != null && Number.isFinite(verNum) ? (verNum as number) : 1;
  return rebuildNicknameTableSnapshot(vFallback);
}

export async function GET(req: Request): Promise<Response> {
  if (!chatRedis) {
    return Response.json({ error: 'redis_unavailable' }, { status: 503 });
  }

  let snapshot = await ensureNicknameTableSnapshot(chatRedis);

  if (!snapshot) {
    return Response.json({ error: 'snapshot_rebuild_failed' }, { status: 500 });
  }

  const myCell = await resolveMyCell(req);

  const body: NicknameTableApiResponse = {
    ...snapshot,
    myCell,
  };

  return Response.json(body, {
    headers: { 'Content-Type': 'application/json' },
  });
}
