/**
 * 이전 `SearchNotice0419` / `SearchNotice0420`는 제거·분리되었습니다.
 * - 공지 UI: `SiteNoticesMenu` (Header, 공지 아이콘)
 * - 0419 본문: `notices/SearchLoadMitigationNotice20260419.tsx` + `searchNoticesRegistry`
 * - 0420 본문(앱 비노출, 보관): `notices/SearchSuspensionNotice20260420.tsx` — 레지스트리에 등록하지 않음
 */

/**
 * @deprecated 앱에서 사용하지 않습니다. 0420은 어떤 경로로도 열리지 않습니다.
 * 보관용 식별자 export — 번들·호출부 없음.
 */
export function SearchNotice0420(): null {
  return null;
}
