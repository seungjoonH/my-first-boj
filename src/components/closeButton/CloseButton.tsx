'use client';

import { forwardRef } from 'react';
import { buildCls } from '@/lib/buildCls';
import iconStyles from '@/components/iconButton/IconButton.module.css';
import type { CloseButtonProps } from './type';

export const CloseButton = forwardRef<HTMLButtonElement, CloseButtonProps>(function CloseButton(
  { className, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={buildCls(iconStyles.btn, className)}
      {...rest}
    >
      <span className={buildCls(iconStyles.icon, iconStyles['icon--close'])} aria-hidden="true" />
    </button>
  );
});
