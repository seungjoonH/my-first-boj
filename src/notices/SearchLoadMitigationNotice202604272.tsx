'use client';

import { useMemo } from 'react';
import { formatServiceEndCountdownOmitZero } from '@/lib/serviceEndCountdownFormat';
import { useServiceEndNow } from '@/hooks/useServiceEndNow';
import { useServiceEndMs } from '@/context/ServiceEndMsContext';
import styles from '@/components/searchNotice/SearchNotice.module.css';

/**
 * [04272] BOJ 서비스 종료·제출 기록 조회 제한
 * 남은 시간은 `useServiceEndNow`로 메인 `Countdown`과 동시에 갱신된다.
 */
export function SearchLoadMitigationNotice202604272() {
  const now = useServiceEndNow();
  const endMs = useServiceEndMs();
  const count = useMemo(
    () => formatServiceEndCountdownOmitZero(now, endMs),
    [now, endMs],
  );

  return (
    <div className={styles.inner}>
      {count.afterEnd ? (
        <>
          <p className={styles.intro}>
            <strong className={styles.introTime}>BOJ 서비스가 종료되었습니다.</strong>
            {' '}
            이후 <strong className={styles.introTime}>BOJ로부터 새로운 데이터를 불러올 수 없습니다.</strong>
          </p>
          <p className={styles.intro}>
            본 서비스는 서비스 종료 이후 BOJ로의 요청을 차단하도록 구현되어
            있으며, 종료 이전에 이미 조회된 기록만 정상적으로 표시됩니다.
            반대로,{' '}
            <strong className={styles.introTime}>
              종료 전까지 한 번도 조회하지 않은 기록은 이후 영구적으로 확인이 어려울 수
              있습니다.
            </strong>
          </p>
          <p className={styles.intro}>
            BOJ·운영 정책에 따라 본 앱에 표기된 종료 기준은 추후
            조정·안내될 수 있습니다. 확인되는 대로 공지·반영하겠습니다. 양해 부탁드립니다.
          </p>
        </>
      ) : (
        <>
          <p className={styles.intro}>
            <strong className={styles.introTime}>약 {count.label} 후</strong>
            {' '}
            BOJ가 서비스를 종료함에 따라, 해당 시점 이후부터는 BOJ로부터 새로운 데이터를 불러오는 것이 불가능해집니다.
          </p>
          <p className={styles.intro}>
            본 서비스는 서비스 종료 이후 BOJ로의 요청을 차단하도록 구현되어
            있으며, 종료 이전에 이미 조회된 기록만 정상적으로 표시됩니다.
            반대로,{' '}
            <strong className={styles.introTime}>
              종료 전까지 한 번도 조회하지 않은 기록은 이후 영구적으로 확인이 어려울 수
              있습니다.
            </strong>
          </p>
          <p className={styles.intro}>
            <strong className={styles.introTime}>4월 28일 00:00:00</strong> 시점에 BOJ
            서비스가 종료되지 않은 것이 확인되어, 카운트다운 기준을{' '}
            <strong className={styles.introTime}>4월 28일 23:59:59</strong>로
            업데이트하였습니다.
          </p>
        </>
      )}
    </div>
  );
}
