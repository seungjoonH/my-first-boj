import type { ComponentType } from 'react';

export type SearchNoticeDef = {
  id: string;
  title: string;
  /** 최신순 정렬 (큰 값이 최신) */
  sortKey: number;
  /** false 이면 레지스트리·UI 어디에도 노출되지 않음 (0420 보관용 등) */
  visible: boolean;
  Content: ComponentType<Record<string, never>>;
};
