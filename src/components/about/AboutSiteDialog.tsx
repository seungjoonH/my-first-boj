'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CloseButton } from '@/components/closeButton/CloseButton';
import { IconButton } from '@/components/iconButton/IconButton';
import styles from './AboutSiteDialog.module.css';

const CONTACT_EMAIL = 'hsj6831@gmail.com';
const BOJ_HOME_URL = 'https://www.acmicpc.net/';
const BOJ_SERVICE_END_NEWS_URL = 'https://www.acmicpc.net/board/view/165799';

function IconCopy(props: { className?: string }) {
  return (
    <svg className={props.className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"
      />
    </svg>
  );
}

function IconCheck(props: { className?: string }) {
  return (
    <svg className={props.className} viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
    </svg>
  );
}

export function AboutSiteDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) handleClose();
  };

  const copyEmail = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => {
        setCopied(false);
        copyTimerRef.current = null;
      }, 1000);
    }
    catch {
      // 클립보드 거부 시 무시
    }
  }, []);

  return (
    <>
      <IconButton
        variant="about"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="about-site-dialog"
        title="이 사이트 소개"
        aria-label="이 사이트 소개"
      />

      <dialog
        id="about-site-dialog"
        ref={dialogRef}
        className={styles.dialog}
        onClose={handleClose}
        onMouseDown={handleBackdropMouseDown}
        aria-label="이 사이트 소개"
      >
        <div className={styles.inner}>
          <div className={styles.headRow}>
            <CloseButton type="button" onClick={handleClose} aria-label="닫기" />
          </div>

          <div>
            <p className={styles.p}>
              이 서비스는 제 20대 시절을 함께한{' '}
              <a
                className={styles.emailLink}
                href={BOJ_HOME_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                백준 온라인 저지
              </a>
              의{' '}
              <a
                className={styles.emailLink}
                href={BOJ_SERVICE_END_NEWS_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                서비스 종료 소식
              </a>
              을 접하고 아쉬운 마음으로 제작한 비영리 팬 사이트이며, 그동안 함께했던 시간을 기념하고 남은 기록을 소중히 간직하고자 제작한 개인 토이 프로젝트입니다.
            </p>
            <p className={styles.p}>
              본 서비스는 개발자 개인이 운영하는 서비스로, 백준 온라인 저지(BOJ) 및 Solved.ac 와는 어떠한 공식적인 관련이 없음을 밝힙니다.
            </p>
            <p className={styles.p}>
              이용 중 문의 사항이 있거나, 문제가 발생한 경우{' '}
              <span className={styles.emailWrap}>
                <a className={styles.emailLink} href={`mailto:${CONTACT_EMAIL}`}>
                  {CONTACT_EMAIL}
                </a>
                <button
                  type="button"
                  className={styles.copyBtn}
                  onClick={copyEmail}
                  aria-label={copied ? '복사됨' : '이메일 주소 복사'}
                  title={copied ? '복사됨' : '복사'}
                >
                  {copied ? <IconCheck className={styles.copyBtnIcon} /> : <IconCopy className={styles.copyBtnIcon} />}
                </button>
              </span>
              으로 알려주시면 신속히 확인 후 조치하겠습니다.
            </p>
            <p className={styles.signoff}>개발자 드림</p>
          </div>
        </div>
      </dialog>
    </>
  );
}
