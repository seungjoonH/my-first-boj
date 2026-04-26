'use client';

import { useEffect, useState } from 'react';

const SUFFIXES = ['', '.', '..', '...'] as const;
const TICK_MS = 420;

type LoadingEllipsisLabelProps = {
  className?: string;
};

/** "불러오는 중" / "불러오는 중." / … 순환 (부모에서 레이아웃·정렬 지정) */
export function LoadingEllipsisLabel({ className }: LoadingEllipsisLabelProps) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % SUFFIXES.length), TICK_MS);
    return () => clearInterval(t);
  }, []);
  return (
    <span className={className}>
      불러오는 중
      {SUFFIXES[i]}
    </span>
  );
}
