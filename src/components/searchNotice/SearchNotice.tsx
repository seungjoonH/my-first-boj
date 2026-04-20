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

export function SearchNotice0419({ hideStrip = false, externalOpen = false, onExternalClose, onViewRecentNotice }: {
  hideStrip?: boolean;
  externalOpen?: boolean;
  onExternalClose?: () => void;
  /** 이전 공지(0419) 모달에서 최신 공지(0420) 다이얼로그로 전환 */
  onViewRecentNotice?: () => void;
}) {
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
    if (externalOpen) setOpen(true);
  }, [externalOpen]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
      document.body.style.overflow = 'hidden';
    }
    else {
      if (el.open) el.close();
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const syncClosed = useCallback(() => {
    setOpen(false);
    onExternalClose?.();
  }, [onExternalClose]);

  /** 배경(backdrop) 클릭: 모달 패널 밖을 눌렀을 때만 닫기 */
  const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) {
      dialogRef.current?.close();
      setOpen(false);
      onExternalClose?.();
    }
  };

  const handleViewRecentNotice = () => {
    dialogRef.current?.close();
    onViewRecentNotice?.();
  };

  return (
    <>
      {!hideStrip && (
        <aside className={styles.strip} role="status">
          <div className={styles.banner}>
            <img src="/icons/notice.svg" alt="" aria-hidden width={18} height={18} className={styles.bannerIcon} />
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
              aria-controls="search-notice-0419-dialog"
            >
              더 보기
            </button>
          </div>
        </aside>
      )}

      <dialog
        id="search-notice-0419-dialog"
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
            이에 따라 이 서비스의 동작 방식과 새 버전(v1.1.4)에서 달라진 점을 함께 안내합니다.{' '}
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

          {onViewRecentNotice && (
            <p className={styles.prevNotice}>
              <button type="button" className={styles.prevNoticeBtn} onClick={handleViewRecentNotice}>
                최근 공지 보기 — 제출 기록 탐색 서비스 중단 안내 (2026.04.20)
              </button>
            </p>
          )}
          </div>
        </div>
      </dialog>
    </>
  );
}

export function SearchNotice0420({
  onViewPrevNotice,
  externalOpen = false,
  onExternalClose,
}: {
  onViewPrevNotice?: () => void;
  externalOpen?: boolean;
  onExternalClose?: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (externalOpen) setOpen(true);
  }, [externalOpen]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
      document.body.style.overflow = 'hidden';
    }
    else {
      if (el.open) el.close();
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const syncClosed = useCallback(() => {
    setOpen(false);
    onExternalClose?.();
  }, [onExternalClose]);

  const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) {
      dialogRef.current?.close();
      setOpen(false);
      onExternalClose?.();
    }
  };

  const handleViewPrevNotice = () => {
    dialogRef.current?.close();
    setOpen(false);
    onViewPrevNotice?.();
  };

  return (
    <>
      <aside className={styles.strip} role="status">
        <div className={styles.banner}>
          <img src="/icons/notice.svg" alt="" aria-hidden width={18} height={18} className={styles.bannerIcon} />
          <div className={styles.bannerBody}>
            <p className={styles.bannerSummary}>
              제출 기록 탐색 서비스 중단 안내
            </p>
          </div>
          <button
            type="button"
            className={styles.moreButton}
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls="search-notice-0420-dialog"
          >
            더 보기
          </button>
        </div>
      </aside>

      <dialog
        id="search-notice-0420-dialog"
        ref={dialogRef}
        className={styles.dialog}
        onClick={handleDialogClick}
        onClose={syncClosed}
        aria-labelledby="search-notice-0420-title"
      >
        <div className={styles.shell} onClick={(e) => e.stopPropagation()}>
          <div className={styles.headRow}>
            <h2 id="search-notice-0420-title" className={styles.title}>
              제출 기록 탐색 서비스 중단 안내
            </h2>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={(e) => {
                e.stopPropagation();
                dialogRef.current?.close();
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
              BOJ 서비스 점검 결정에 따라,<br />BOJ로 요청을 보내는 이 서비스의{' '}
              <strong className={styles.introTime}>제출 기록 탐색 기능을 무기한 중단</strong>합니다.
            </p>
            <p className={styles.intro}>
              점검이 종료되더라도 원 서비스의 정책에 따라{' '}
              <strong className={styles.introTime}>탐색 기능이 복구되지 않을 수 있습니다.</strong>
            </p>

            <div className={styles.existingBlock}>
              <p className={styles.blockLabel}>이용 안내</p>
              <ol className={styles.numberedList}>
                <li>
                  <span className={styles.itemHeading}>기존 조회 내역이 있는 사용자</span>
                  <p className={styles.itemBody}>
                    이미 조회를 수행한 기록이 있는 경우, <strong>캐시된 결과를 그대로 조회</strong>하실 수 있습니다.
                    BOJ에 새 요청을 보내지 않으므로, 중단 기간 중에도 정상적으로 이용 가능합니다.
                  </p>
                </li>
                <li>
                  <span className={styles.itemHeading}>신규 사용자</span>
                  <p className={styles.itemBody}>
                    아직 조회 내역이 없는 경우, <strong>중단이 해제될 때까지</strong>{' '}
                    제출 기록 탐색을 이용하실 수 없습니다.
                  </p>
                </li>
                <li>
                  <span className={styles.itemHeading}>채팅 서비스</span>
                  <p className={styles.itemBody}>
                    채팅 서비스는 이번 중단과 무관하게 <strong>정상적으로 이용</strong>하실 수 있습니다.
                  </p>
                </li>
              </ol>
            </div>

            {onViewPrevNotice && (
              <p className={styles.prevNotice}>
                <button type="button" className={styles.prevNoticeBtn} onClick={handleViewPrevNotice}>
                  이전 공지 보기 — 검색 부하 완화 안내 (2026.04.19)
                </button>
              </p>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
