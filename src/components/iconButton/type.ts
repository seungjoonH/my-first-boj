import type { ButtonHTMLAttributes } from 'react';

export type IconButtonIconVariant = 'about' | 'history' | 'notice';

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style' | 'children'> & {
  variant: IconButtonIconVariant;
  /**
   * 접근성: 반드시 의미를 전하는 라벨 (필수 시 `aria-label`이 됨)
   * `label` + 나머지 `aria-*` 는 버튼 루트에 전달.
   */
  'aria-label': string;
  children?: never;
};
