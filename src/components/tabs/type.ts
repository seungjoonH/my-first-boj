import type { SearchMode } from '@/types/search';

export interface TabsProps {
  active: SearchMode;
  onChange: (mode: SearchMode) => void;
}
