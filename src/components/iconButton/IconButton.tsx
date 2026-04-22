'use client';

import { forwardRef } from 'react';
import { buildCls } from '@/lib/buildCls';
import type { IconButtonProps } from './type';
import styles from './IconButton.module.css';

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant, type: typeProp, className, ...rest },
  ref,
) {
  let iconMod = styles['icon--notice'];
  switch (variant) {
    case 'about':
      iconMod = styles['icon--about'];
      break;
    case 'history':
      iconMod = styles['icon--history'];
      break;
    case 'notice':
    default:
      break;
  }
  const iconClass = buildCls(styles.icon, iconMod);
  return (
    <button
      ref={ref}
      type={typeProp ?? 'button'}
      className={buildCls(styles.btn, className)}
      {...rest}
    >
      <span className={iconClass} aria-hidden="true" />
    </button>
  );
});
