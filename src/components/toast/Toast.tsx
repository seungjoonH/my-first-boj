import styles from './toast.module.css';
import { buildCls } from '@/lib/buildCls';
import type { ToastProps } from './type';

export function Toast({ message }: ToastProps) {
  const className = buildCls(styles.root, message !== null && styles.visible);
  return (
    <div className={className} role="status" aria-live="polite">
      {message}
    </div>
  );
}
