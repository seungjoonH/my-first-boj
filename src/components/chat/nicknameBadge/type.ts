import type { BBadgeVariant } from '@/lib/chatConstants';

export type NicknameBadgeBaseProps = {
  aBadge: string;
  bBadge: string;
  bVariant: BBadgeVariant;
  /** 닉네임 도감 격자: 줄바꿈 없이 한 줄·말줄임(행 높이 고정) */
  layout?: 'default' | 'mapCell';
};
