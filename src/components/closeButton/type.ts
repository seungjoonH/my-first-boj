import type { ButtonHTMLAttributes } from 'react';

export type CloseButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style' | 'children'> & {
  'aria-label': string;
  children?: never;
};
