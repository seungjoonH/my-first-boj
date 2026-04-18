import { memo } from 'react';
import type { SearchMode } from '@/types/search';
import { buildCls } from '@/lib/buildCls';
import type { TabsProps } from './type';
import styles from './tabs.module.css';

const TABS: { mode: SearchMode; label: string }[] = [
  { mode: 'first', label: '첫 제출' },
  { mode: 'correct', label: '첫 정답' },
  { mode: 'wrong', label: '첫 오답' },
];

export const Tabs = memo(function Tabs({ active, onChange }: TabsProps) {
  return (
    <div className={styles.root}>
      {TABS.map(({ mode, label }) => {
        const isActive = active === mode;
        const className = buildCls(styles.tab, isActive && styles.active);
        return (
          <button
            key={mode}
            type="button"
            aria-pressed={isActive}
            className={className}
            onClick={() => onChange(mode)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
});
