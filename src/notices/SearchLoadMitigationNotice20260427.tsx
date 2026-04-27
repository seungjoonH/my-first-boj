'use client';

import { useEffect, useState } from 'react';
import { useServiceEndMs } from '@/context/ServiceEndMsContext';
import { formatRelativePastKo } from '@/lib/relativeTimeKo';
import styles from '@/components/searchNotice/SearchNotice.module.css';

const BOJ_FIRST_SUBMIT_TIP_BOARD_URL = 'https://www.acmicpc.net/board/view/166213';
/** 본문 “n분 전” — 참고 글 기준(고정) */
const NOTICE_POSTED_AT_MS = new Date('2026-04-26T21:45:33+09:00').getTime();

function formatServiceEndDateKo(ms: number): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(ms));
}

/**
 * 탐색 전략 개선 및 사과 (v1.2.0)
 */
export function SearchLoadMitigationNotice20260427() {
  const endMs = useServiceEndMs();
  const [postedAgoLabel, setPostedAgoLabel] = useState(() =>
    formatRelativePastKo(NOTICE_POSTED_AT_MS, Date.now()),
  );

  useEffect(() => {
    function refreshPostedAgo(): void {
      setPostedAgoLabel(formatRelativePastKo(NOTICE_POSTED_AT_MS, Date.now()));
    }
    refreshPostedAgo();
    const id = window.setInterval(refreshPostedAgo, 60_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className={styles.inner}>
      <p className={styles.intro}>
        <strong className={styles.introTime}>{postedAgoLabel}</strong>에 올라온{' '}
        <a className={styles.link} href={BOJ_FIRST_SUBMIT_TIP_BOARD_URL} target="_blank" rel="noopener noreferrer">
          백준 게시판 글
        </a>을 참고해 제출 기록을 찾는 방식을 개선했습니다.
      </p>
      <p className={styles.intro}>
        기존 <strong>이진 탐색</strong> 방식은 백준 서버에 불필요한 요청을 과도하게 발생시킬 수
        있었습니다. 초기 구현상의 미흡함과 장기간 미개선에 대해 사과드립니다.
      </p>
      <p className={styles.intro}>
        <strong className={styles.introEndDate}>{formatServiceEndDateKo(endMs)}</strong>
        까지 백준 온라인 저지 서비스에 무리가 가지 않도록 계속 조정해 나가겠습니다.
      </p>

      <div className={styles.existingBlock}>
        <p className={styles.blockLabel}>기존 적용</p>
        <ol className={styles.numberedList}>
          <li>
            <span className={styles.itemHeading}>O(log n) 탐색 전략</span>
            <p className={styles.itemBody}>
              <strong>이진 탐색</strong>으로 제출 기록을 찾습니다. 총 제출 기록은 약{' '}
              <strong>105,100,000</strong>개로, 최악 <strong>27번</strong>의
              요청을 수행합니다.
            </p>
          </li>
        </ol>
      </div>

      <div className={styles.updateBlock}>
        <p className={styles.updateBlockTitle}>신규 적용 (v1.2.0)</p>
        <ol className={styles.numberedListUpdate}>
          <li>
            <span className={styles.itemHeading}>O(1) 탐색 전략</span>
            <p className={styles.itemBody}>
              채점 현황을 <code>top=1</code> 기준으로 조회한 뒤, <strong>이전 페이지</strong>를 한
              번만 이동해 가장 오래된 제출 목록에 바로 접근합니다. 기존 이진 탐색 대비 요청 횟수를
              대폭 줄였습니다.
            </p>
          </li>
        </ol>
      </div>
    </div>
  );
}
