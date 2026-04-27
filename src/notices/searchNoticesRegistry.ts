import type { SearchNoticeDef } from './type';
import { SearchLoadMitigationNotice20260419 } from './SearchLoadMitigationNotice20260419';
import { SearchLoadMitigationNotice20260427 } from './SearchLoadMitigationNotice20260427';
import { SearchLoadMitigationNotice202604272 } from './SearchLoadMitigationNotice202604272';
import { noticeVer } from './noticeVersionSort';

/** 가장 최근 — 목록·벨 음영 등 UI에서 동일 id로 식별 */
export const SEARCH_NOTICE_RECENT_HIGHLIGHT_ID = 'search-boj-shutdown-preload-2026-04-27-04272';

/**
 * 앱에 노출되는 공지만 `visible: true`로 등록.
 * 0420 등 비노출 본문은 별도 파일에만 두고 여기에 넣지 않는다.
 * sortKey: `noticeVer` — 레지스트리·정렬용 (공지 “게시 시각” 상수와 분리)
 */
export const SEARCH_NOTICES: readonly SearchNoticeDef[] = [
  {
    id: SEARCH_NOTICE_RECENT_HIGHLIGHT_ID,
    title: 'BOJ 서비스 종료에 따른 제출 기록 조회 제한 안내',
    sortKey: noticeVer(1, 2, 1),
    visible: true,
    Content: SearchLoadMitigationNotice202604272,
  },
  {
    id: 'search-load-mitigation-2026-04-27-v1-2-0',
    title: 'BOJ 서버 부하 완화 안내 v1.2.0',
    sortKey: noticeVer(1, 2, 0),
    visible: true,
    Content: SearchLoadMitigationNotice20260427,
  },
  {
    id: 'search-load-mitigation-2026-04-19',
    title: 'BOJ 서버 부하 완화 안내 v1.1.4',
    sortKey: noticeVer(1, 1, 4),
    visible: true,
    Content: SearchLoadMitigationNotice20260419,
  },
];

export function getVisibleSearchNoticesOrdered(): SearchNoticeDef[] {
  return [...SEARCH_NOTICES]
    .filter((entry) => entry.visible)
    .sort((a, b) => b.sortKey - a.sortKey);
}
