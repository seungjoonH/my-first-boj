import 'server-only';

import { NICKNAME_B_COL_COUNT } from '@/lib/chatConstants';
import { isReservedChatUuid } from '@/lib/chatAdmin';
import {
  batchGetEffectiveSalts,
  chatRedis,
  nickTableSnapshotKey,
  nickUnlockedMemberKey,
  nickUnlockedSetKey,
  userSaltHashKey,
} from '@/lib/chatRedis';
import { A_BADGE_FLAT_TOTAL, computeNicknameGridCoords } from '@/lib/chatNickname';
import type { NicknameTableSnapshot } from '@/types/chatNicknameTable';

/** 한 번의 `SADD` 호출에 넣을 멤버 수(가변 인자 1커맨드, Upstash 커맨드 수 절감) */
const SADD_CHUNK_SIZE = 400;

/** salt 해시 전 스캔·해금 SET 병합·스냅샷 저장까지 한 번에 수행 */
export async function rebuildNicknameTableSnapshot(version: number): Promise<NicknameTableSnapshot> {
  const redis = chatRedis;
  if (!redis) {
    throw new Error('chatRedis unavailable');
  }

  const rawKeys = await redis.hkeys(userSaltHashKey());
  const uuids = Array.isArray(rawKeys) ? rawKeys : [];
  const eligible = uuids.filter((u) => u && !isReservedChatUuid(u));
  const effectiveByUuid = await batchGetEffectiveSalts(eligible);

  const occupancy: number[][] = Array.from({ length: A_BADGE_FLAT_TOTAL }, () =>
    Array<number>(NICKNAME_B_COL_COUNT).fill(0),
  );

  for (const uuid of eligible) {
    const salt = effectiveByUuid.get(uuid) ?? '';
    if (!salt) continue;
    const { flatIndex, bIndex } = computeNicknameGridCoords(uuid, salt);
    if (flatIndex < 0 || flatIndex >= A_BADGE_FLAT_TOTAL) continue;
    if (bIndex < 0 || bIndex >= NICKNAME_B_COL_COUNT) continue;
    occupancy[flatIndex][bIndex] += 1;
  }

  const rawMembers = await redis.smembers(nickUnlockedSetKey());
  const unlockList = Array.isArray(rawMembers) ? rawMembers : [];
  const unlockSet = new Set(unlockList);

  const unlocked: boolean[][] = Array.from({ length: A_BADGE_FLAT_TOTAL }, () =>
    Array<boolean>(NICKNAME_B_COL_COUNT).fill(false),
  );
  let totalUnlockedCount = 0;
  const backfillKeys: string[] = [];

  for (let f = 0; f < A_BADGE_FLAT_TOTAL; f++) {
    for (let b = 0; b < NICKNAME_B_COL_COUNT; b++) {
      const k = nickUnlockedMemberKey(f, b);
      const isUnlocked = occupancy[f][b] > 0 || unlockSet.has(k);
      unlocked[f][b] = isUnlocked;
      if (isUnlocked) totalUnlockedCount += 1;
      if (occupancy[f][b] > 0 && !unlockSet.has(k)) backfillKeys.push(k);
    }
  }

  const setKey = nickUnlockedSetKey();
  for (let i = 0; i < backfillKeys.length; i += SADD_CHUNK_SIZE) {
    const slice = backfillKeys.slice(i, i + SADD_CHUNK_SIZE);
    if (slice.length === 0) continue;
    const [first, ...rest] = slice;
    await redis.sadd(setKey, first, ...rest);
  }

  const generatedAt = Date.now();
  const snapshot: NicknameTableSnapshot = {
    version,
    generatedAt,
    occupancy,
    unlocked,
    totalUnlockedCount,
  };

  await redis.set(nickTableSnapshotKey(), JSON.stringify(snapshot));

  return snapshot;
}
