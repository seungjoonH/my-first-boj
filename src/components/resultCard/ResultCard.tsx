'use client';

import { memo, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { formatAbsolute, formatRelative, getDurationTotals } from '@/lib/formatDate';
import { ResultBadge } from '@/components/resultBadge/ResultBadge';
import { BOJ_BASE } from '@/lib/constants';
import { useServiceEndMs } from '@/context/ServiceEndMsContext';
import type { ResultCardProps } from './type';
import styles from './resultCard.module.css';

const LIVE_INTERVAL_MS = 500;
const DURATION_UNITS: { key: keyof ReturnType<typeof getDurationTotals>; label: string; particle: '을' | '를' }[] = [
  { key: 'years',   label: '년',   particle: '을' },
  { key: 'months',  label: '개월', particle: '을' },
  { key: 'days',    label: '일',   particle: '을' },
  { key: 'hours',   label: '시간', particle: '을' },
  { key: 'minutes', label: '분',   particle: '을' },
  { key: 'seconds', label: '초',   particle: '를' },
];

function SubmittedAtLiveText({ submittedAt, showRelative }: { submittedAt: string; showRelative: boolean }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, LIVE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  const liveDateRelative = formatRelative(submittedAt, now);
  return showRelative ? `${liveDateRelative} 전` : formatAbsolute(submittedAt);
}

function FirstModeLiveSection({ submittedAt, userId }: { submittedAt: string; userId: string }) {
  const [now, setNow] = useState(() => Date.now());
  const serviceEndMs = useServiceEndMs();

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, LIVE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  const effectiveNow = now >= serviceEndMs ? serviceEndMs : now;
  const relativeDisplay = formatRelative(submittedAt, effectiveNow);
  const totals = getDurationTotals(submittedAt, effectiveNow);

  const submittedAtMs = new Date(submittedAt.replace(' ', 'T') + '+09:00').getTime();
  const totalDuration = Math.max(1, serviceEndMs - submittedAtMs);
  const elapsed = Math.max(0, effectiveNow - submittedAtMs);
  const journeyPercent = Math.min(100, (elapsed / totalDuration) * 100);
  const journeyPercentText = journeyPercent === 100 ? '100%' : `${journeyPercent.toFixed(6)}%`;
  const journeyFillStyle = { '--journey-percent': `${journeyPercent}%` } as CSSProperties;
  const isBeforeServiceEnd = now < serviceEndMs;
  const togetherStatusText = isBeforeServiceEnd ? '함께하고 있습니다.' : '함께 했습니다.';
  const startLabel = submittedAt.split(' ')[0].replace(/-/g, '.');
  const endLabel = new Date(serviceEndMs).toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/\. /g, '.').replace(/\.$/, '');

  return (
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
  );
}

export const ResultCard = memo(function ResultCard({ result, mode, userId }: ResultCardProps) {
  const [showRelative, setShowRelative] = useState(true);

  const { submissionId, problemId, submittedAt, language, result: resultText, resultColor } = result;
  const resultBadgeNode = useMemo(
    () => <ResultBadge result={resultText} resultColor={resultColor} />,
    [resultText, resultColor],
  );

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
            <SubmittedAtLiveText submittedAt={submittedAt} showRelative={showRelative} />
          </button>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>언어</span>
          <span className={styles.value}>{language}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>결과</span>
          <span className={styles.value}>
            {resultBadgeNode}
          </span>
        </div>
      </div>
      {mode === 'first' && <FirstModeLiveSection submittedAt={submittedAt} userId={userId} />}
    </div>
  );
}, (prev, next) => {
  if (prev.mode !== next.mode) return false;
  if (prev.userId !== next.userId) return false;
  return (
    prev.result.submissionId === next.result.submissionId &&
    prev.result.problemId === next.result.problemId &&
    prev.result.problemTitle === next.result.problemTitle &&
    prev.result.submittedAt === next.result.submittedAt &&
    prev.result.language === next.result.language &&
    prev.result.result === next.result.result &&
    prev.result.resultColor === next.result.resultColor
  );
});
