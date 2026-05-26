# 나의 첫 백준은?

<br clear="both" />
<br clear="both" />

<div align="center">

**백준 아이디를 입력하면 첫 제출/첫 정답/첫 오답을 즉시 탐색하는 서비스**

<blockquote>이 서비스는 제 20대 시절을 함께한 백준 온라인 저지의 서비스 종료 소식을 접하고 아쉬운 마음으로 제작한 비영리 팬 사이트이며,<br/>그동안 함께했던 시간을 기념하고 남은 기록을 소중히 간직하고자 제작한 개인 토이 프로젝트입니다.</blockquote>

<br />
<br />

<a href="https://my-first-boj.vercel.app" target="_blank"><img width="300" alt="production" src="https://github.com/user-attachments/assets/73bf2e31-8d65-4c6d-b3f0-71cbae1c51c6" /></a>


</div>

<br clear="both" />
<br clear="both" />
<br clear="both" />

## Features

<br clear="both" />

### 1. 첫 제출 / 첫 정답 / 첫 오답 조회

탭에서 확인할 항목을 고른 뒤 백준 아이디를 입력하면 BOJ 제출 현황을 실시간으로 탐색합니다. <br />
제출 번호, 문제 번호, 제출 시각, 언어, 결과를 결과 카드에서 확인할 수 있습니다.

<img width="777" alt="첫 화면" src="https://github.com/user-attachments/assets/18078c8d-ecbf-4fe5-a984-5accb40c837d" />


<br clear="both" />

### 2. 아이디 입력 및 결과 확인

`백준 아이디를 입력하세요` 입력창에 아이디를 적고 `찾아보기`를 클릭하면 탐색이 시작됩니다. <br />
`제출 시각`을 클릭해 상대 시간 / 절대 시간 표시를 전환하고, `다시 찾아보기`로 이어서 조회할 수 있습니다.

<img width="777" alt="아이디 입력" src="https://github.com/user-attachments/assets/7b328338-5053-4cdc-8b63-e568def8e5ce" />

<br clear="both" />

### 3. 결과 카드

결과 카드에서 제출 정보와 결과 상태를 한눈에 확인합니다. <br />
조회 결과는 LocalStorage에 저장되어 다음 방문 시 바로 불러옵니다.

<img width="777" alt="결과 확인" src="https://github.com/user-attachments/assets/b3034068-07ac-4a64-b1ec-8a89f65e2c53" />

<br clear="both" />

### 4. 검색 기록

사이드바에서 이전 조회 기록을 탭 · 아이디별로 관리합니다. <br />
항목을 클릭하면 결과를 바로 이어볼 수 있고, 개별 삭제와 전체 삭제를 지원합니다.

<img width="777" alt="검색 기록" src="https://github.com/user-attachments/assets/d935af80-79b2-4bed-8b28-cc63bf19a82e" />

<br clear="both" />

### 5. 글로벌 채팅

SSE 기반 실시간 채팅으로 마지막 기억을 함께 남기는 공간입니다. <br />
첫 방문 시 Cookie UUID가 자동 발급되고, 닉네임과 티어(루비/다이아/플래티넘/골드/실버/브론즈)가 배정됩니다. <br />
`BOJ`, `백준`, `baekjoon` 언급 횟수를 집계해 집단적 기억의 총량을 카운터로 표시합니다.

<img width="777" alt="글로벌 채팅" src="https://github.com/user-attachments/assets/ac6668d0-58bb-445c-90cf-d540dd007c2e" />

<br clear="both" />

### 6. 닉네임 뽑기

채팅방 헤더의 닉네임 변경 버튼을 클릭하면 닉네임이 랜덤으로 다시 배정됩니다. <br />
변경 후에는 쿨다운 대기 시간이 적용되며, 이전 닉네임 슬롯은 닉네임 테이블에 해제됩니다.

<img width="555" alt="닉네임 뽑기" src="https://github.com/user-attachments/assets/efc4772b-e844-4ecb-bf8a-1d82b6cc9dcd" />

### 7. 닉네임 테이블

채팅 닉네임을 그리드 형태로 시각화합니다. <br />
잠금 해제된 닉네임 슬롯과 조합 규칙을 한눈에 확인할 수 있습니다.

<img width="777" alt="닉네임 테이블" src="https://github.com/user-attachments/assets/a5995e8b-4b73-467d-b8bc-24e420094d59" />


<br clear="both" />
<br clear="both" />
<br clear="both" />

## Tech Stacks

<br clear="both" />

#### Frontend

<span>
  <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white">
  <img src="https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=white">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white">
  <img src="https://img.shields.io/badge/CSS_Modules-000000?style=for-the-badge&logo=cssmodules&logoColor=white">
</span>

#### Backend

<span>
  <img src="https://img.shields.io/badge/Next.js_Route_Handlers-000000?style=for-the-badge&logo=next.js&logoColor=white">
  <img src="https://img.shields.io/badge/SSE-0F766E?style=for-the-badge">
  <img src="https://img.shields.io/badge/cheerio-E88C1F?style=for-the-badge">
</span>

#### Data

<span>
  <img src="https://img.shields.io/badge/Upstash_Redis-00E9A3?style=for-the-badge&logo=upstash&logoColor=white">
</span>

#### Deploy

<span>
  <img src="https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white">
</span>

<br clear="both" />
<br clear="both" />
<br clear="both" />

## Architecture

<br clear="both" />
<br clear="both" />

<img alt="architecture" src="https://github.com/user-attachments/assets/dbaa80d6-e61f-4f5e-96e9-911bbe590795" />

<br clear="both" />
<br clear="both" />
<br clear="both" />

## Getting Started

<br clear="both" />

### 설치 및 실행

```sh
# 저장소 클론
git clone https://github.com/seungjoonH/first-baekjoon.git

cd first-baekjoon

# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

<br />

### 기본 포트

- `http://localhost:3000`

<br />

### 환경변수

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Upstash Redis (채팅 기능 사용 시 필요)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# BOJ 요청 헤더 (선택)
BOJ_USER_AGENTS=[]
BOJ_ACCEPT_LANGUAGE=
BOJ_ACCEPT=

# 채팅 관리자 설정 (선택)
CHAT_ADMIN_UUID=
CHAT_PROOF_SECRET=
```

<br clear="both" />
<br clear="both" />
<br clear="both" />

## License

MIT License · Copyright (c) 2026 seungjoonH · [LICENSE](LICENSE)
