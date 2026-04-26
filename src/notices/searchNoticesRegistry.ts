import { BOJ_SCRAPING_NOTICE_POSTED_AT_MS, SEARCH_STRATEGY_UPDATE_NOTICE_POSTED_AT_MS } from '@/lib/constants';
import type { SearchNoticeDef } from './type';
import { SearchLoadMitigationNotice20260419 } from './SearchLoadMitigationNotice20260419';
import { SearchLoadMitigationNotice20260427 } from './SearchLoadMitigationNotice20260427';

/** 가장 최근 부하 완화 공지 — 목록·벨 음영 등 UI에서 동일 id로 식별 */
export const SEARCH_NOTICE_RECENT_HIGHLIGHT_ID = 'search-load-mitigation-2026-04-27-v1-2-0';

/**
 * 앱에 노출되는 공지만 `visible: true`로 등록.
 * 0420 등 비노출 본문은 별도 파일에만 두고 여기에 넣지 않는다.
 */
export const SEARCH_NOTICES: readonly SearchNoticeDef[] = [
  {
    id: SEARCH_NOTICE_RECENT_HIGHLIGHT_ID,
    title: '백준 서버 부하 완화 안내 v1.2.0',
    sortKey: SEARCH_STRATEGY_UPDATE_NOTICE_POSTED_AT_MS,
    visible: true,
    Content: SearchLoadMitigationNotice20260427,
  },
  {
    id: 'search-load-mitigation-2026-04-19',
    title: '백준 서버 부하 완화 안내 v1.1.4',
    sortKey: BOJ_SCRAPING_NOTICE_POSTED_AT_MS,
    visible: true,
    Content: SearchLoadMitigationNotice20260419,
  },
];

export function getVisibleSearchNoticesOrdered(): SearchNoticeDef[] {
  return [...SEARCH_NOTICES]
    .filter((entry) => entry.visible)
    .sort((a, b) => b.sortKey - a.sortKey);
}
