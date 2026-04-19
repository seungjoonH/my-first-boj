'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BOJ_SCRAPING_NOTICE_POSTED_AT_MS, SERVICE_END_MS } from '@/lib/constants';
import { formatRelativePastKo } from '@/lib/relativeTimeKo';
import styles from './SearchNotice.module.css';

const BOJ_SCRAPING_NOTICE_URL = 'https://www.acmicpc.net/board/view/166082';

function formatServiceEndDateKo(ms: number): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(ms));
}

function IconNotice(props: { className?: string }) {
  return (
    <svg
      className={props.className}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"
      />
    </svg>
  );
}

export function SearchNotice() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [postedAgoLabel, setPostedAgoLabel] = useState(() =>
    formatRelativePastKo(BOJ_SCRAPING_NOTICE_POSTED_AT_MS, Date.now()),
  );

  useEffect(() => {
    function refreshPostedAgo(): void {
      setPostedAgoLabel(formatRelativePastKo(BOJ_SCRAPING_NOTICE_POSTED_AT_MS, Date.now()));
    }
    refreshPostedAgo();
    const id = window.setInterval(refreshPostedAgo, 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    }
    else if (el.open) {
      el.close();
    }
  }, [open]);

  const syncClosed = useCallback(() => {
    setOpen(false);
  }, []);

  /** 배경(backdrop) 클릭: 모달 패널 밖을 눌렀을 때만 닫기 */
  const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) {
      dialogRef.current?.close();
      setOpen(false);
    }
  };

  return (
    <>
      <aside className={styles.strip} role="status">
        <div className={styles.banner}>
          <IconNotice className={styles.bannerIcon} aria-hidden />
          <div className={styles.bannerBody}>
            <p className={styles.bannerSummary}>
              백준 검색 부하 완화 안내
            </p>
          </div>
          <button
            type="button"
            className={styles.moreButton}
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls="search-notice-dialog"
          >
            더 보기
          </button>
        </div>
      </aside>

      <dialog
        id="search-notice-dialog"
        ref={dialogRef}
        className={styles.dialog}
        onClick={handleDialogClick}
        onClose={syncClosed}
        aria-labelledby="search-notice-title"
      >
        <div className={styles.shell} onClick={(e) => e.stopPropagation()}>
          <div className={styles.headRow}>
            <h2 id="search-notice-title" className={styles.title}>
              백준 서버 부하 완화 안내
            </h2>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={(e) => {
                e.stopPropagation();
                dialogRef.current?.close();
                /* onClose 미발화·CSS로만 보이던 경우 대비해 React 상태도 맞춤 */
                setOpen(false);
              }}
              aria-label="닫기"
            >
              <svg className={styles.closeIcon} viewBox="0 0 24 24" aria-hidden>
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  d="M7 7l10 10M17 7L7 17"
                />
              </svg>
            </button>
          </div>

          <div className={styles.inner}>
          <p className={styles.intro}>
            <strong className={styles.introTime}>{postedAgoLabel}</strong>, 과도한 웹 스크래핑 자제를 당부하는{' '}
            <a className={styles.link} href={BOJ_SCRAPING_NOTICE_URL} target="_blank" rel="noopener noreferrer">
              공지
            </a>
            가 게시되었습니다.
          </p>
          <p className={styles.intro}>
            이에 따라 이 서비스의 동작 방식과 새 버전(v1.1.1)에서 달라진 점을 함께 안내합니다.{' '}
            <strong className={styles.introEndDate}>{formatServiceEndDateKo(SERVICE_END_MS)}</strong>
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
                  탐색 중간 상태는 <strong>원격 서버</strong>에 단계별로 저장합니다.{' '}
                  요청 시간이 초과되어 중간에 끊겨도 <strong>마지막으로 저장된 단계부터</strong> 이어서
                  검색할 수 있습니다. 이미 찾은 결과는 <strong>원격 저장소</strong>와 <strong>로컬 저장소</strong>에 캐시해 두어, 다시 검색할 때는 BOJ에 요청하지 않습니다.
                </p>
              </li>
              <li>
                <span className={styles.itemHeading}>요청 간격</span>
                <p className={styles.itemBody}>
                  짧은 시간에 요청을 연달아 보내지 않습니다. 한 요청에 대한 응답을 받은 뒤, 그다음 요청을 보내기 전에{' '}
                  <strong>약 100ms~300ms</strong> 정도의 무작위 간격을 두어 요청의 부하를 줄였습니다.
                </p>
              </li>
            </ol>
          </div>

          <div className={styles.updateBlock}>
            <p className={styles.updateBlockTitle}>신규 적용 (v1.1.1)</p>
            <ol className={styles.numberedListUpdate}>
              <li>
                <span className={styles.itemHeading}>요청 간격 상향</span>
                <p className={styles.itemBody}>
                  부하 완화를 위해, 응답을 받은 뒤 다음 요청까지 두는 간격을 <strong>350ms~750ms</strong> 수준으로
                  늘렸습니다. 이에 따라 탐색 속도가 다소 느려질 수 있습니다.
                </p>
              </li>
              <li>
                <span className={styles.itemHeading}>재검색 제한</span>
                <p className={styles.itemBody}>
                  같은 브라우저에서 같은 검색 모드로는 <strong>30초에 한 번만</strong> 새 검색을 시작할 수 있도록
                  제한을 두었습니다. 너른 양해 부탁드립니다.
                </p>
              </li>
            </ol>
          </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
