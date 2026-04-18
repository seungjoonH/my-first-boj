import { memo } from 'react';
import { buildCls } from '@/lib/buildCls';
import type { ResultBadgeProps } from './type';
import styles from './resultBadge.module.css';

export const ResultBadge = memo(function ResultBadge({ result, resultColor }: ResultBadgeProps) {
  const className = buildCls(styles.badge, styles[resultColor]);

  return (
    <span className={className}>
      {result}
    </span>
  );
});
