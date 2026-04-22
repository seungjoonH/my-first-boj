'use client';

import { useEffect, useRef, useState } from 'react';
import {
  B_BADGE_VARIANT_MAP,
  CHAT_DIAMOND_LANGUAGES,
  LANGUAGES,
  type BBadgeVariant,
} from '@/lib/chatConstants';
import {
  A_BADGE_FLAT_TOTAL,
  combineTiers,
  getTierLabelKo,
  splitMemoryByteSuffix,
  getATierFromBadge,
  getBBadgeTier,
  type ChatTier,
} from '@/lib/chatNickname';
import { buildCls } from '@/lib/buildCls';
import { CloseButton } from '@/components/closeButton/CloseButton';
import { NicknameChangeButton } from '../nicknameChangeButton/NicknameChangeButton';
import { TierIcon } from '../tierIcon/TierIcon';
import { NicknameBadgeBase } from '../nicknameBadge/NicknameBadge';
import nicknameBadgeStyles from '../nicknameBadge/NicknameBadge.module.css';
import type { ChatNicknameTierHelpDialogProps } from './type';
import styles from './ChatNicknameTierHelpDialog.module.css';

const DIAMOND_LANG_SET = new Set<string>(CHAT_DIAMOND_LANGUAGES);
/** 언어 슬롯 75개 중 다이아 목록에 없는 문자열(플래티넘) — `LANGUAGES[0..74]` 순서 유지 */
const PLATINUM_SLOT_LANGUAGES = LANGUAGES.slice(0, 75).filter((lang) => !DIAMOND_LANG_SET.has(lang));

/** `getABadgeTextFromFlatIndex` 와 동일한 형식의 예시 (닉네임 줄 A 뱃지와 같음). 1·2티어는 배열 기반 미리보기 */
const A_ROWS: {
  tier: ChatTier;
  count: string;
  ratio: string;
  example?: string;
  examples?: string[];
  aJudging?: boolean;
  aTime?: boolean;
}[] = [
  { tier: 0, example: '524288 B', count: '1', ratio: '≈ 0.17%' },
  { tier: 1, count: '18', ratio: '≈ 3.05%' },
  { tier: 2, count: '57', ratio: '≈ 9.65%' },
  { tier: 3, examples: ['채점 중 (0%)', '채점 중 (1%)', '채점 중 (100%)'], count: '101', ratio: '≈ 17.09%', aJudging: true },
  { tier: 4, examples: ['1초 전', '1분 전', '1시간 전', '16년 전'], count: '157', ratio: '≈ 26.57%', aTime: true },
  { tier: 5, examples: ['0 B', '1 B', '256 B'], count: '257', ratio: '≈ 43.5%' },
];

function ALanguagePreview({
  variant,
  onOpenFullList,
}: {
  variant: 'diamond' | 'platinum';
  onOpenFullList: (v: 'diamond' | 'platinum') => void;
}) {
  const fullText =
    variant === 'diamond'
      ? CHAT_DIAMOND_LANGUAGES.join(' · ')
      : PLATINUM_SLOT_LANGUAGES.join(' · ');

  return (
    <div className={styles.aLangPreview}>
      <div className={styles.aLangPreviewList} title={fullText}>
        <span className={buildCls(nicknameBadgeStyles.badge, nicknameBadgeStyles.badgeA)}>{fullText}</span>
      </div>
      <button
        className={styles.aLangMoreButton}
        type="button"
        onClick={() => onOpenFullList(variant)}
      >
        더 보기
      </button>
    </div>
  );
}

/** 최종 티어 안내 표 — `combineTiers` 결과와 동일 */
const FINAL_TIER_EXAMPLES: { a: ChatTier; b: ChatTier }[] = [
  { a: 3, b: 4 },
  { a: 4, b: 4 },
  { a: 1, b: 1 },
];

const B_ROWS: { tier: ChatTier; message: string; pct: number }[] = [
  { tier: 1, message: '맞았습니다!!', pct: 4 },
  { tier: 2, message: '틀렸습니다', pct: 8 },
  { tier: 3, message: '시간 초과', pct: 6 },
  { tier: 3, message: '메모리 초과', pct: 6 },
  { tier: 3, message: '출력 초과', pct: 6 },
  { tier: 4, message: '컴파일 에러', pct: 20 },
  { tier: 4, message: '런타임 에러', pct: 20 },
  { tier: 5, message: '출력 형식이 잘못되었습니다', pct: 15 },
  { tier: 5, message: '채점 준비 중', pct: 15 },
];

/** `NicknameBadge` 의 B 뱃지 색과 동일 (`B_BADGE_VARIANT_MAP`) */
const B_VARIANT_CLASS: Record<BBadgeVariant, string> = {
  ac: nicknameBadgeStyles['badgeB--ac'],
  wa: nicknameBadgeStyles['badgeB--wa'],
  tle: nicknameBadgeStyles['badgeB--tle'],
  ce: nicknameBadgeStyles['badgeB--ce'],
  rte: nicknameBadgeStyles['badgeB--rte'],
  muted: nicknameBadgeStyles['badgeB--muted'],
};

function bBadgeDemoCls(message: string): string {
  const v = B_BADGE_VARIANT_MAP[message] ?? 'muted';
  return buildCls(nicknameBadgeStyles.badge, B_VARIANT_CLASS[v]);
}

export function ChatNicknameTierHelpDialog({
  open,
  onClose,
  aBadge,
  bBadge,
  bVariant,
  finalTier,
  nickCooldownRemaining,
  onChangeNickname,
}: ChatNicknameTierHelpDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [openLangPanel, setOpenLangPanel] = useState<null | 'diamond' | 'platinum'>(null);
  const myATier = getATierFromBadge(aBadge);
  const myBTier = getBBadgeTier(bBadge);
  const isCoolingDown = nickCooldownRemaining > 0;
  const cooldownLabel = (() => {
    const s = nickCooldownRemaining;
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hours > 0) return `${hours}시간 후 변경 가능`;
    if (minutes > 0) return `${minutes}분 후 변경 가능`;
    return `${secs}초 후 변경 가능`;
  })();

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    }
    else {
      if (el.open) el.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) setOpenLangPanel(null);
  }, [open]);

  useEffect(() => {
    if (!openLangPanel) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setOpenLangPanel(null);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [openLangPanel]);

  const handleDialogMouseDown = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onClose={onClose}
      onMouseDown={handleDialogMouseDown}
      aria-labelledby="nickname-tier-help-title"
    >
      <div className={buildCls(styles.inner, openLangPanel !== null && styles.innerScrollLock)}>
        <div className={styles.headRow}>
          <h2 id="nickname-tier-help-title" className={styles.title}>
            닉네임 티어
          </h2>
          <CloseButton type="button" onClick={onClose} aria-label="닫기" />
        </div>

        <div className={styles.myNicknameSection}>
          <div className={styles.myNicknameLeft}>
            <TierIcon tier={finalTier} />
            <NicknameBadgeBase aBadge={aBadge} bBadge={bBadge} bVariant={bVariant} />
          </div>
          {isCoolingDown ? (
            <span className={styles.cooldownLabel}>{cooldownLabel}</span>
          ) : (
            <NicknameChangeButton onClick={onChangeNickname} />
          )}
        </div>

        <h3 className={styles.subheading}>A 뱃지 티어 확률</h3>
        <p className={styles.lede}>
          {`가능한 값 ${A_BADGE_FLAT_TOTAL.toLocaleString('ko-KR')}가지 중 균등 확률로 한 개가 선택됩니다.`}
        </p>
        <div className={styles.tableWrap}>
          <table className={`${styles.probTable} ${styles.probTableA}`}>
            <thead>
              <tr>
                <th scope="col" className={styles.colTierIcon}>
                  티어
                </th>
                <th scope="col" className={styles.colAExample}>
                  A 뱃지 예시
                </th>
                <th scope="col" className={styles.colCompact}>
                  가짓수
                </th>
                <th scope="col" className={styles.colCompactNum}>
                  확률
                </th>
              </tr>
            </thead>
            <tbody>
              {A_ROWS.map((row) => (
                <tr key={row.tier} className={row.tier === myATier ? styles.highlightRow : undefined}>
                  <th scope="row" className={buildCls(styles.colTierIcon, styles.tierIconCell)}>
                    <TierIcon tier={row.tier} />
                  </th>
                  <td className={styles.aExampleCell}>
                    {row.tier === 1 && (
                      <ALanguagePreview variant="diamond" onOpenFullList={setOpenLangPanel} />
                    )}
                    {row.tier === 2 && (
                      <ALanguagePreview variant="platinum" onOpenFullList={setOpenLangPanel} />
                    )}
                    {row.tier !== 1 && row.tier !== 2 && row.example !== undefined && (() => {
                      const aCls = buildCls(
                        nicknameBadgeStyles.badge,
                        row.aJudging
                          ? nicknameBadgeStyles['badgeA--judging']
                          : row.aTime
                            ? nicknameBadgeStyles['badgeA--time']
                            : nicknameBadgeStyles.badgeA,
                      );
                      const parts = splitMemoryByteSuffix(row.example);
                      return (
                        <span className={aCls}>
                          {parts.unitPart !== undefined ? (
                            <>
                              {parts.valuePart}
                              <span className={nicknameBadgeStyles.badgeAByte}>{parts.unitPart}</span>
                            </>
                          ) : (
                            row.example
                          )}
                        </span>
                      );
                    })()}
                    {row.tier !== 1 && row.tier !== 2 && row.examples !== undefined && (() => {
                      const aCls = buildCls(
                        nicknameBadgeStyles.badge,
                        row.aJudging
                          ? nicknameBadgeStyles['badgeA--judging']
                          : row.aTime
                            ? nicknameBadgeStyles['badgeA--time']
                            : nicknameBadgeStyles.badgeA,
                      );
                      return (
                        <span className={styles.aExampleRange}>
                          {row.examples.flatMap((ex, i) => {
                            const parts = splitMemoryByteSuffix(ex);
                            const badge = (
                              <span key={ex} className={aCls}>
                                {parts.unitPart !== undefined ? (
                                  <>
                                    {parts.valuePart}
                                    <span className={nicknameBadgeStyles.badgeAByte}>{parts.unitPart}</span>
                                  </>
                                ) : ex}
                              </span>
                            );
                            const isLast = i === row.examples!.length - 1;
                            const isSecondToLast = i === row.examples!.length - 2;
                            if (isLast) return [badge];
                            if (isSecondToLast) return [
                              badge,
                              <span key={`sep-${i}`} className={styles.aExampleSep}>,</span>,
                              <span key="dots" className={styles.aExampleDots}>···</span>,
                              <span key="sep-dots" className={styles.aExampleSep}>,</span>,
                            ];
                            return [
                              badge,
                              <span key={`sep-${i}`} className={styles.aExampleSep}>,</span>,
                            ];
                          })}
                        </span>
                      );
                    })()}
                  </td>
                  <td className={styles.colCompact}>{row.count}</td>
                  <td className={buildCls(styles.colCompactNum, styles.ratioCell)}>{row.ratio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <h3 className={styles.subheading}>B 뱃지 티어 확률</h3>
        <p className={styles.lede}>
          아래 9가지 결과 문구 중 가중치에 따라 하나가 선택됩니다.
        </p>
        <div className={styles.tableWrap}>
          <table className={`${styles.probTable} ${styles.probTableB}`}>
            <thead>
              <tr>
                <th scope="col" className={styles.colTierIcon}>
                  티어
                </th>
                <th scope="col" className={styles.colBResult}>
                  B 뱃지 예시
                </th>
                <th scope="col" className={styles.colPct}>
                  확률
                </th>
              </tr>
            </thead>
            <tbody>
              {B_ROWS.map((row) => (
                <tr key={row.message} className={row.message === bBadge ? styles.highlightRow : undefined}>
                  <td className={buildCls(styles.colTierIcon, styles.tierIconCell)}>
                    <TierIcon tier={row.tier} />
                  </td>
                  <td className={styles.bBadgeDemoCell}>
                    <span className={bBadgeDemoCls(row.message)}>{row.message}</span>
                  </td>
                  <td className={buildCls(styles.pctCell, styles.colPct)}>{row.pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className={styles.subheading}>최종 닉네임 티어</h3>
        <p className={styles.lede}>
          티어는 A, B 뱃지 티어를 아래 규칙으로 합친 결과입니다.
        </p>
        <ol className={styles.finalTierRules}>
          <li>
            두 티어가 <strong>다르면</strong> 그중 <strong>더 높은 티어</strong>를
            따릅니다.
          </li>
          <li>
            두 티어가 <strong>같으면</strong> 그보다 <strong>한 단계 더 높은 티어</strong>를 따릅니다.
          </li>
        </ol>
        <p className={styles.finalTierExampleLabel}>예시</p>
        <div className={styles.tableWrap}>
          <table className={`${styles.probTable} ${styles.finalTierTable}`}>
            <thead>
              <tr>
                <th scope="col">A 뱃지 티어</th>
                <th scope="col">B 뱃지 티어</th>
                <th scope="col">최종 티어</th>
              </tr>
            </thead>
            <tbody>
              {FINAL_TIER_EXAMPLES.map((ex) => {
                const finalTier = combineTiers(ex.a, ex.b);
                return (
                  <tr key={`${ex.a}-${ex.b}`}>
                    <td>
                      <span className={styles.finalTierCell}>
                        <TierIcon tier={ex.a} />
                        {getTierLabelKo(ex.a)}
                      </span>
                    </td>
                    <td>
                      <span className={styles.finalTierCell}>
                        <TierIcon tier={ex.b} />
                        {getTierLabelKo(ex.b)}
                      </span>
                    </td>
                    <td>
                      <span className={styles.finalTierCell}>
                        <TierIcon tier={finalTier} />
                        {getTierLabelKo(finalTier)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {openLangPanel !== null && (
        <div
          className={styles.langPanelBackdrop}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpenLangPanel(null);
          }}
        >
          <div
            className={styles.langPanel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="lang-list-panel-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className={styles.langPanelHead}>
              <h4 id="lang-list-panel-title" className={styles.langPanelTitle}>
                {openLangPanel === 'diamond'
                  ? `다이아 언어 슬롯 (${CHAT_DIAMOND_LANGUAGES.length})`
                  : `플래티넘 언어 슬롯 (${PLATINUM_SLOT_LANGUAGES.length})`}
              </h4>
              <CloseButton type="button" onClick={() => setOpenLangPanel(null)} aria-label="목록 닫기" />
            </div>
            <ul className={styles.langPanelList}>
              {(openLangPanel === 'diamond' ? CHAT_DIAMOND_LANGUAGES : PLATINUM_SLOT_LANGUAGES).map((lang) => (
                <li key={lang} className={buildCls(styles.langPanelItem, lang === aBadge && styles.langPanelItemHighlight)}>
                  {lang}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </dialog>
  );
}
