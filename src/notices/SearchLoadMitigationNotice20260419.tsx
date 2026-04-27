'use client';

import { useEffect, useState } from 'react';
import { useServiceEndMs } from '@/context/ServiceEndMsContext';
import { formatRelativePastKo } from '@/lib/relativeTimeKo';
import styles from '@/components/searchNotice/SearchNotice.module.css';

const BOJ_SCRAPING_NOTICE_URL = 'https://www.acmicpc.net/board/view/166082';
/** 본문 “n분 전” — 게시판 글 기준(고정) */
const NOTICE_POSTED_AT_MS = new Date('2026-04-19T16:55:05+09:00').getTime();

function formatServiceEndDateKo(ms: number): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(ms));
}

/**
 * 2026-04-19 — 백준 서버 부하 완화 안내 (검색 띠 공지 → 헤더 공지 메뉴로 이전)
 */
export function SearchLoadMitigationNotice20260419() {
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
        <strong className={styles.introTime}>{postedAgoLabel}</strong>, 과도한 웹 스크래핑 자제를 당부하는{' '}
        <a className={styles.link} href={BOJ_SCRAPING_NOTICE_URL} target="_blank" rel="noopener noreferrer">
          공지
        </a>
        가 게시되었습니다.
      </p>
      <p className={styles.intro}>
        이에 따라 이 서비스의 동작 방식과 새 버전(v1.1.4)에서 달라진 점을 함께 안내합니다.{' '}
        <strong className={styles.introEndDate}>{formatServiceEndDateKo(endMs)}</strong>
        까지 백준 온라인 저지 서비스에 무리가 가지 않도록 최선을 다하겠습니다.
      </p>

      <div className={styles.existingBlock}>
        <p className={styles.blockLabel}>기존 적용</p>
        <ol className={styles.numberedList}>
          <li>
            <span className={styles.itemHeading}>탐색 전략</span>
            <p className={styles.itemBody}>
              <strong>이진 탐색</strong>으로 제출 기록을 찾습니다. 총 제출 기록은 약{' '}
              <strong>105,100,000</strong>개로, 최악 <strong>27번</strong>의
              요청을 수행합니다.
            </p>
          </li>
          <li>
            <span className={styles.itemHeading}>단계별 저장 및 캐시</span>
            <p className={styles.itemBody}>
              탐색 중간 상태는 <strong>원격 저장소</strong>에 단계별로 저장합니다.{' '}
              요청 시간이 초과되어 중간에 끊겨도 <strong>마지막으로 저장된 단계부터</strong> 이어서
              검색할 수 있습니다. 이미 찾은 결과는 <strong>원격 저장소</strong>와 <strong>로컬 저장소</strong>에 캐시해 두어, 다시 검색할 때는 BOJ에 요청하지 않습니다.
            </p>
          </li>
          <li>
            <span className={styles.itemHeading}>재검색 제한</span>
            <p className={styles.itemBody}>
              같은 브라우저에서 같은 검색 모드로는 <strong>30초에 한 번만</strong> 새 검색을 시작할 수 있도록
              제한을 두었습니다.
            </p>
          </li>
          <li>
            <span className={styles.itemHeading}>요청 간격</span>
            <p className={styles.itemBody}>
              짧은 시간에 요청을 연달아 보내지 않습니다. 한 요청에 대한 응답을 받은 뒤, 그다음 요청을 보내기 전에{' '}
              <strong>약 350ms~750ms</strong> 정도의 무작위 간격을 두어 BOJ로 나가는 요청의 부하를 줄입니다.
            </p>
          </li>
        </ol>
      </div>

      <div className={styles.updateBlock}>
        <p className={styles.updateBlockTitle}>신규 적용 (v1.1.4)</p>
        <ol className={styles.numberedListUpdate}>
          <li>
            <span className={styles.itemHeading}>동시 탐색 상한</span>
            <p className={styles.itemBody}>
              서버 부하를 고려해 <strong>한 번에 처리할 수 있는 탐색 인원에 제한</strong>을 두었습니다.{' '}
              동시 접속 가능 인원을 초과하여 진행이 되지 않을 경우,{' '}
              <strong>잠시 후 다시 시도해 주세요</strong>. 해당 제한 수치는 서버 상황에 따라 유동적으로
              변경될 수 있습니다.
            </p>
          </li>
        </ol>
      </div>
    </div>
  );
}
