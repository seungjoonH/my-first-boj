'use client';

import { useEffect, useState } from 'react';
import { formatAbsolute, formatRelative, getDurationTotals } from '@/lib/formatDate';
import { ResultBadge } from '@/components/resultBadge/ResultBadge';
import { BOJ_BASE, SERVICE_END_MS } from '@/lib/constants';
import type { ResultCardProps } from './type';
import styles from './resultCard.module.css';

const CLOCK_INTERVAL_MS = 500;

const DURATION_UNITS: { key: keyof ReturnType<typeof getDurationTotals>; label: string; particle: '을' | '를' }[] = [
  { key: 'years',   label: '년',   particle: '을' },
  { key: 'months',  label: '개월', particle: '을' },
  { key: 'days',    label: '일',   particle: '을' },
  { key: 'hours',   label: '시간', particle: '을' },
  { key: 'minutes', label: '분',   particle: '을' },
  { key: 'seconds', label: '초',   particle: '를' },
];

export function ResultCard({ result, mode, userId }: ResultCardProps) {
  const [showRelative, setShowRelative] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), CLOCK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const { submissionId, problemId, submittedAt, language, result: resultText, resultColor } = result;

  const currentNow = now;
  const effectiveNow = currentNow >= SERVICE_END_MS ? SERVICE_END_MS : currentNow;

  // 제출 시각 토글: 현재 시각 기준 (계속 갱신)
  const liveDateRelative = formatRelative(submittedAt, currentNow);
  const dateDisplay = showRelative ? `${liveDateRelative} 전` : formatAbsolute(submittedAt);

  // 함께했습니다 블록: 서비스 종료일 기준으로 고정
  const relativeDisplay = formatRelative(submittedAt, effectiveNow);
  const totals = getDurationTotals(submittedAt, effectiveNow);

  const submittedAtMs = new Date(submittedAt.replace(' ', 'T') + '+09:00').getTime();
  const totalDuration = Math.max(1, SERVICE_END_MS - submittedAtMs);
  const elapsed = Math.max(0, effectiveNow - submittedAtMs);
  const journeyPercent = Math.min(100, (elapsed / totalDuration) * 100);
  const journeyPercentText = journeyPercent === 100 ? '100%' : `${journeyPercent.toFixed(6)}%`;
  const journeyFillStyle = { '--journey-percent': `${journeyPercent}%` } as React.CSSProperties;
  const isBeforeServiceEnd = currentNow < SERVICE_END_MS;
  const togetherStatusText = isBeforeServiceEnd ? '함께하고 있습니다.' : '함께 했습니다.';
  const startLabel = submittedAt.split(' ')[0].replace(/-/g, '.');
  const endLabel = new Date(SERVICE_END_MS).toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/\. /g, '.').replace(/\.$/, '');

  function handleToggleDate() {
    setShowRelative((prev) => !prev);
  }

  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <div className={styles.row}>
          <span className={styles.label}>제출 번호</span>
          <a
            className={styles.value}
            href={`${BOJ_BASE}/source/${submissionId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            #{submissionId}
          </a>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>문제</span>
          <span className={styles.problemCell}>
            <a
              className={styles.value}
              href={`${BOJ_BASE}/problem/${problemId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {problemId}
            </a>
            {result.problemTitle && (
              <span className={styles.problemTitle}>{result.problemTitle}</span>
            )}
          </span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>제출 시각</span>
          <button
            className={styles.dateToggle}
            onClick={handleToggleDate}
            title={showRelative ? '절대 날짜로 보기' : '상대 날짜로 보기'}
          >
            {dateDisplay}
          </button>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>언어</span>
          <span className={styles.value}>{language}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>결과</span>
          <span className={styles.value}>
            <ResultBadge result={resultText} resultColor={resultColor} />
          </span>
        </div>
      </div>
      {mode === 'first' && (
        <>
          <div className={styles.journeyBlock}>
            <div className={styles.journeyLabels}>
              <span className={styles.journeyStart}>{startLabel}</span>
              <span className={styles.journeyPercent}>
                {journeyPercentText}
              </span>
              <span className={styles.journeyEnd}>{endLabel}</span>
            </div>
            <div className={styles.journeyBar}>
              <div className={styles.journeyFill} style={journeyFillStyle} />
            </div>
          </div>
          <div className={styles.togetherBlock}>
            <p className={styles.togetherMain}>
              <a
                className={styles.userLink}
                href={`${BOJ_BASE}/user/${userId}`}
                target="_blank"
                rel="noopener noreferrer"
              >{userId}</a>님은 백준과{' '}
              <span className={styles.durationMain}>{relativeDisplay}</span>
              {relativeDisplay.endsWith('초') ? '를' : '을'}{' '}
              {togetherStatusText}
            </p>
            <div className={styles.durationList}>
              {DURATION_UNITS.filter(({ key }) => totals[key] > 0).map(({ key, label, particle }) => (
                <p key={key} className={styles.durationItem}>
                  <span className={styles.durationNum}>{totals[key].toLocaleString()}</span>
                  {label}{particle}{' '}
                  {togetherStatusText}
                </p>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
