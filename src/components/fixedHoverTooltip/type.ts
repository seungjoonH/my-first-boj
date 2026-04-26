import type { ReactNode } from 'react';

export type FixedHoverTooltipProps = {
  children: ReactNode;
  /** 키워드 배경 툴팁과 동일한 고정 위치 스타일 */
  content: ReactNode;
  /** 앵커 `div`에 추가 클래스 (예: 잠금 셀 z-index 스택) */
  anchorClassName?: string;
};
