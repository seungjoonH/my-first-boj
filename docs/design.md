# 백준 첫 제출 탐색 서비스 — 기획 및 설계 문서

## 1. 서비스 개요

사용자의 백준(BOJ) 제출 기록에서 **가장 첫 번째 제출**을 효율적으로 찾아주는 웹 서비스.

### 조회 모드 (3가지)

| 모드 | 설명 |
|------|------|
| 첫 제출 | 결과 무관, 가장 오래된 제출 |
| 첫 정답 | 처음으로 맞았습니다를 받은 제출 |
| 첫 오답 | 처음으로 틀린 제출 |

### 출력 정보

- 제출 번호
- 제출 문제 번호
- 제출 시각 ← 가장 중요
- 제출 언어
- 결과 (맞았습니다 / 틀렸습니다 등)

---

## 2. 기술 스택

| 항목 | 선택 |
|------|------|
| 프레임워크 | Next.js (App Router) |
| 언어 | TypeScript |
| 스타일링 | CSS Modules |
| 배포 | Vercel |
| 외부 크롤링 | Next.js Route Handler (서버 사이드) |

---

## 3. 핵심 알고리즘

### 3.1 전제

- BOJ 상태 페이지 URL 구조: `/status?user_id={ID}&top={X}`
- `top=X`: 해당 유저의 제출 중 **ID ≤ X인 것들**만 표시 (최대 20개)
- 제출 ID는 단조 증가

### 3.2 판별 함수

세 모드 모두 동일한 이진 탐색 구조. 종료 후 추출 방식만 다름.

| row 수 | 처리 |
|--------|------|
| 0 | `lo = mid + 1` |
| 1 ~ 19 | 첫 제출/정답: 마지막 row 반환 **즉시 종료** / 첫 오답: 오답 없으면 `lo = mid + 1`, 있으면 `hi = mid` |
| 20 | `hi = mid` (무조건) |

**종료 후 추출 (`top=lo` 페이지)**

| 모드 | 추출 방식 |
|------|----------|
| 첫 제출 | 마지막 row |
| 첫 정답 | 마지막 row (result_id=4 필터로 AC만 표시됨) |
| 첫 오답 | 마지막 비-AC row |

### 3.3 이진 탐색 (leftmost binary search)

```
lo = 1
hi = 유저 최신 제출 ID  ← /status?user_id=ID 첫 row에서 파싱

while lo < hi:
    mid = (lo + hi) // 2
    rows = fetch /status?user_id=ID&top=mid 파싱

    if rows == 0:
        lo = mid + 1
    elif rows < 20:
        return last_row  # 즉시 종료
    else:
        hi = mid

# 루프 종료 시 lo == hi == 첫 제출 ID
result = fetch /status?user_id=ID&top=lo → last row
```

### 3.4 모드별 전략

| 모드 | URL | 종료 후 추출 |
|------|-----|-------------|
| 첫 제출 | `result_id=-1` | 마지막 row |
| 첫 정답 | `result_id=4` | 마지막 row |
| 첫 오답 | `result_id=-1` | 마지막 **비-AC** row |

**첫 오답 판별 조건 (이진 탐색 중)**

| rows | 조건 | 처리 |
|------|------|------|
| 0 | - | `lo = mid + 1` |
| 1~19 | 비-AC row 없음 | `lo = mid + 1` |
| 1~19 | 비-AC row 있음 | `hi = mid` |
| 20 | - | `hi = mid` (무조건) |

### 3.5 시간 복잡도

- 최악: `O(log N)` ≈ 27회 요청 (N ≈ 105,000,000)
- 평균: 조기 종료(1~19 rows) 덕분에 더 적음
- 요청 간 딜레이: **0.5 ~ 1.5초 랜덤** (BOJ 서버 부하 방지)

---

## 4. API 설계

### Route: `POST /api/search`

**Request Body**

```json
{
  "userId": "string",
  "mode": "first" | "correct" | "wrong"
}
```

**Streaming Response** (text/event-stream)

```
// 진행 중
data: { "type": "progress", "percent": 23 }

// 완료
data: { "type": "result", "submissionId": 12345, "problemId": 1000, "submittedAt": "2019-03-14 22:31:07", "language": "C++17", "result": "맞았습니다!!", "resultColor": "ac" }

// 제출 없음
data: { "type": "empty" }

// 에러
data: { "type": "error", "message": "..." }
```

### 퍼센티지 계산

```
percent = ((log2(hi) - log2(hi - lo)) / log2(hi)) * 100
```

범위가 좁아질수록 progress 증가.

---

## 5. 캐싱 (localStorage)

### 전략

동일한 `userId + mode` 조합은 결과가 변하지 않으므로 **영구 캐시**.

캐시 히트 시 서버 요청 없이 즉시 결과 표시.

### 캐시 키 구조

```
boj-first:{userId}:{mode}
```

예시:
```
boj-first:zkunimi:first   → 첫 제출 결과
boj-first:zkunimi:correct → 첫 정답 결과
boj-first:zkunimi:wrong   → 첫 오답 결과
```

### 캐시 값 구조

```json
{
  "submissionId": 12345678,
  "problemId": 1000,
  "submittedAt": "2019-03-14 22:31:07",
  "language": "C++17",
  "result": "맞았습니다!!",
  "resultColor": "ac"
}
```

### 동작 흐름

```
버튼 클릭
  ↓
localStorage 조회
  ├─ 캐시 있음 → rate limit 체크 없이 즉시 결과 표시
  └─ 캐시 없음 → rate limit 체크 → API 요청 → 결과 수신 → 캐시 저장 → 결과 표시
```

### 캐시 저장 시 교차 저장 (클라이언트 사이드)

첫 제출 결과 수신 후:
- 결과가 AC → `correct` 캐시도 함께 저장 (첫 제출 = 첫 정답)
- 결과가 non-AC → `wrong` 캐시도 함께 저장 (첫 제출 = 첫 오답)

```
첫 제출 검색 결과 = "맞았습니다!!"
  → boj-first:{id}:first  저장
  → boj-first:{id}:correct 도 저장  ← 첫 정답 검색 시 캐시 히트

첫 제출 검색 결과 = "틀렸습니다" (또는 기타 오답)
  → boj-first:{id}:first 저장
  → boj-first:{id}:wrong 도 저장   ← 첫 오답 검색 시 캐시 히트
```

---

## 6. Rate Limiting (클라이언트)

클라이언트 사이드만 적용. (서버 사이드 생략 — 일반 사용자 수준의 연타 방지가 목적이므로 충분)

- 버튼 클릭 시각 기록 (배열, 최근 2회)
- 30초 이내 2회 초과 시 버튼 비활성화 + 남은 시간 안내 메시지 표시
- 탐색 진행 중에도 버튼 비활성화
- 우회 가능하지만 서비스 규모상 허용

---

## 6. 크롤링 처리

### Headers

```
User-Agent: Mozilla/5.0 (compatible browser string)
```

BOJ 차단 방지를 위해 브라우저처럼 보이는 헤더 세팅 필수.

### 에러 처리

| 상황 | 처리 |
|------|------|
| 존재하지 않는 유저 | 결과 카드 자리에 검정 텍스트: "제출 내역이 없습니다" |
| 제출 내역 없음 | 결과 카드 자리에 검정 텍스트: "제출 내역이 없습니다" |
| 해당 모드 결과 없음 | 결과 카드 자리에 검정 텍스트: "제출 내역이 없습니다" |
| BOJ 응답 지연/에러 | 토스트: "잠시 후 다시 시도해주세요" |
| 파싱 실패 | 토스트: "잠시 후 다시 시도해주세요" |

---

## 7. UI 구조

### 7.1 레이아웃 원칙

- 싱글 페이지, 전체 세로 중앙 정렬
- 콘텐츠 영역 최대 너비: **480~560px**, 가로 중앙 정렬
- 사이드바 없음 / 상단 네비게이션 없음
- 장식 이미지·일러스트·배경 이미지 없음
- 모든 컴포넌트 **sharp corner** (border-radius: 0 또는 2px 이하)

### 7.2 전체 구조

```
[헤더]
  my first boj  (좌상단, 소형)

[콘텐츠 영역 — 최대 480~560px, 중앙]

  [헤드라인]
    나의 첫 백준은?
    나의 첫 제출 내역을 확인해보세요.

  [탭]
    첫 제출 | 첫 정답 | 첫 오답
    (활성 탭: 하단 파란 underline, 비활성: muted)

  ─────────────────────────── (상태에 따라 아래 셋 중 하나)

  [A. 입력 상태]
    [ 백준 아이디를 입력하세요 ]
    [       찾아보기       ]

  [B. 로딩 상태 — 입력 영역 대체]
    ════════════════ (thin progress bar, 23%)
    탐색 중... 23%

  [C. 결과 상태 — 입력 영역 대체]
    ┌───────────────────────┐
    │ 제출 번호   #12345678  │
    │ 문제 번호   1000       │
    │ 제출 시각   2019년 ...  │
    │ 언어       C++17      │
    │ 결과       맞았습니다!! │
    └───────────────────────┘
    다시 찾아보기
```

### 7.3 상태 전환

제출 후 입력 영역(인풋 + 버튼)은 **완전히 사라지고** 동일한 위치에 로딩 또는 결과로 교체된다.
`다시 찾아보기` 클릭 시 입력 상태로 복귀.

### 7.4 탭 스타일

- 활성 탭: 하단 파란 underline (bottom border), 텍스트 강조
- 비활성 탭: muted 색상
- pill/캡슐 형태 없음 — flat tab + bottom border only

### 7.5 결과 배지 색상

모든 결과 색상은 **CSS Variables**로 관리한다.

| 결과 | CSS Variable | 값 |
|------|-------------|-----|
| 맞았습니다!! | `--result-ac` | `#009874` |
| 출력 형식이 잘못되었습니다 | `--result-pe` | `#fa7268` |
| 틀렸습니다 | `--result-wa` | `#dd4124` |
| 시간 초과 | `--result-tle` | `#fa7268` |
| 메모리 초과 | `--result-mle` | `#fa7268` |
| 출력 초과 | `--result-ole` | `#fa7268` |
| 런타임 에러 | `--result-rte` | `#5f4b8b` |
| 컴파일 에러 | `--result-ce` | `#0f4c81` |

> `data-color` 실제 값(ac/wa/tle 등)은 구현 시 BOJ HTML에서 확인 필요.

### 7.6 결과 카드 인터랙션

#### 제출 번호
- `<a href="https://www.acmicpc.net/source/{submissionId}" target="_blank">`

#### 문제 번호
- `<a href="https://www.acmicpc.net/problem/{problemId}" target="_blank">`

#### 제출 시각
- 기본값: **절대 날짜** (`2019년 3월 14일 오후 10:31`)
- 클릭 시 **상대 날짜**로 토글, 다시 클릭 시 복귀

**상대 날짜 포맷** (KST 기준)

```
X년 X개월 X일 X시간 X분 X초 전
```

- 0인 단위는 생략 (`3년 2일 전`, `5시간 30분 전`)
- 1초 미만은 `방금 전`

---

## 8. 미결 사항

- [x] 첫 오답 전략 확정 → result_id 필터 없이 이진 탐색, 마지막 비-AC row 추출
- [x] result_id 값 확인 완료 (HTML select에서 추출)
- [x] 파싱 구조 확인 완료 → cheerio로 #status-table tbody tr 선택
- [x] 에러 메시지 확정
- [x] 입력 유효성 검사 → 빈값/공백/올바르지않은입력 시 버튼 비활성화
- [x] 스타일링 → CSS Modules
- [x] rate limit → 클라이언트 사이드만으로 결정
- [ ] Vercel 배포 시 Streaming response timeout 테스트 필요
- [x] 필터 방식 확정 → 탭 형식 (첫 제출 / 첫 정답 / 첫 오답), 드롭다운 없음

### 파싱 구조 (cheerio)

```
#status-table tbody tr        → row 수 카운트
tr:last-child                 → 마지막 (가장 오래된) row
  td:first-child              → 제출 번호
  td a[href^="/problem/"]     → 문제 번호
  span.result-text            → 결과 텍스트 / data-color (ac, wa, ...)
  td:nth-child(7)             → 언어
  a[data-timestamp]           → 제출 시각 (title 속성: "2026-04-14 21:58:17")
```

### result_id 값

| result_id | 결과 |
|-----------|------|
| 4 | 맞았습니다!! |
| 5 | 출력 형식이 잘못되었습니다 |
| 6 | 틀렸습니다 |
| 7 | 시간 초과 |
| 8 | 메모리 초과 |
| 9 | 출력 초과 |
| 10 | 런타임 에러 |
| 11 | 컴파일 에러 |
