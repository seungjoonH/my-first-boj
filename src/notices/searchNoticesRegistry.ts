import { BOJ_SCRAPING_NOTICE_POSTED_AT_MS } from '@/lib/constants';
import type { SearchNoticeDef } from './type';
import { SearchLoadMitigationNotice20260419 } from './SearchLoadMitigationNotice20260419';

/**
 * 앱에 노출되는 공지만 `visible: true`로 등록.
 * 0420 등 비노출 본문은 별도 파일에만 두고 여기에 넣지 않는다.
 */
export const SEARCH_NOTICES: readonly SearchNoticeDef[] = [
  {
    id: 'search-load-mitigation-2026-04-19',
    title: '백준 서버 부하 완화 안내',
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
