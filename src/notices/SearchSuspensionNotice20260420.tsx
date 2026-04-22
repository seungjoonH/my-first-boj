'use client';

/**
 * 2026-04-20 — 제출 기록 탐색 서비스 중단 안내
 *
 * 앱에서 사용하지 않습니다(레지스트리 미등록, 어떤 경로로도 열리지 않음).
 * 출처: 이전 `SearchNotice0420` 모달 본문. 보관용.
 */
import styles from '@/components/searchNotice/SearchNotice.module.css';

export function SearchSuspensionNotice20260420() {
  return (
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
    </div>
  );
}
