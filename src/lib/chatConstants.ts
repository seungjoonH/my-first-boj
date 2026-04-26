export const MESSAGE_MAX_LEN = 140;
export const CHAT_MESSAGES_REDIS_MAX = 200;
export const KEYWORD_REDIS_MAX = 500;
export const KEYWORD_DISPLAY_MAX = 200;
export const KEYWORD_PARALLAX_FACTOR = 0.4;

export const MSG_RL_TTL_SEC = 10;

export const NICK_RL_TTL_SEC = 30;
export const NICK_RL_TTL_CONFIG_KEY = 'chat:config:nick_rl_ttl_sec';

export const SSE_POLL_BASE_MS = 10_000;
export const SSE_POLL_MAX_MS = 15_000;
export const SSE_BACKOFF_THRESHOLD = 5;
export const SSE_HEARTBEAT_MS = 30_000;
/** 스트림 폴링 시 `LRANGE` — 전체 200 대신 꼬리만 (초과 시 한 번만 전체 조회) */
export const SSE_STREAM_MSG_TAIL = 120;
/** 스트림 루프마다 `touchOnline` 하지 않고 이 간격마다만 (접속자 수 갱신 지연 허용) */
export const SSE_ONLINE_TOUCH_INTERVAL_MS = 25_000;
export const WIDGET_INACTIVITY_MINUTES = 1;
export const WIDGET_INACTIVITY_MS = WIDGET_INACTIVITY_MINUTES * 60 * 1000;

export const MSG_CLIENT_RL_MS = 10000;

export const KEYWORD_ID_PREFIX = 'kw-';
export const CHAT_SESSION_STORAGE_KEY = 'chat-cs';
export const CHAT_LOCAL_STORAGE_KEY = 'chat-cl';
export const MAX_WARN_COUNT = 3;

export const HEAL_LOCAL_INTERVAL_MS = 60_000;
export const HEAL_COOKIE_INTERVAL_MS = 90_000;
export const HEAL_COOKIE_COOLDOWN_MS = 25_000;
export const KW_ENTER_DELAY_STEP_MS = 12;
export const TOOLTIP_Y_OFFSET_PX = 8;

/** [docs/chat-nickname-tier.md] 다이아(1티어) 언어 문자열 — `LANGUAGES[0..74]` 슬롯과 교집합으로 판별 */
export const CHAT_DIAMOND_LANGUAGES: readonly string[] = [
  'C11',
  'C11 (Clang)',
  'C99',
  'C++14',
  'C++17',
  'C++20',
  'C++17 (Clang)',
  'C++20 (Clang)',
  'Java 8',
  'Java 11',
  'Java 17',
  'Java 21',
  'Python 3',
  'Python 2',
  'PyPy3',
  'PyPy2',
  'node.js',
  'TypeScript',
] as const;

export const LANGUAGES: string[] = [
  'C11',
  'C++14',
  'C++17',
  'C++20',
  'C++17 (Clang)',
  'C++20 (Clang)',
  'C11 (Clang)',
  'C99',
  'Java 8',
  'Java 11',
  'Java 17',
  'Java 21',
  'Python 3',
  'Python 2',
  'PyPy3',
  'PyPy2',
  'Ruby',
  'Kotlin (JVM)',
  'Kotlin (Native)',
  'Swift',
  'Rust 2021',
  'Go',
  'D',
  'PHP',
  'Perl',
  'Pascal',
  'Lua',
  'Haskell',
  'Scala',
  'C#',
  'Visual Basic',
  'F#',
  'node.js',
  'TypeScript',
  'Bash',
  'sh',
  'Fortran',
  'Ada',
  'Brainfuck',
  'Whitespace',
  'Tcl',
  'Objective-C',
  'Objective-C++',
  'OCaml',
  'Nim',
  'Assembly (32bit)',
  'Assembly (64bit)',
  'R',
  'GNU Octave',
  'Crystal',
  'Elixir',
  'Erlang',
  'Clojure',
  'Lolcode',
  'Golfscript',
  'Rhino',
  'MySQL',
  'PostgreSQL',
  'MIPS (gcc)',
  'Scheme',
  'Pike',
  'GNU bc',
  'dc',
  'Cobol',
  'Awk',
  'Nemerle',
  'Racket',
  'Common Lisp (SBCL)',
  'Emacs Lisp',
  'F# .NET',
  'Zig',
  'Pawn',
  'Text',
  'C (MSVC)',
  'Carbon',
];

export const B_BADGES: string[] = [
  '맞았습니다!!',
  '틀렸습니다',
  '시간 초과',
  '메모리 초과',
  '출력 초과',
  '컴파일 에러',
  '런타임 에러',
  '출력 형식이 잘못되었습니다',
  '채점 준비 중',
];

/** `B_BADGES` 열별 티어 — `getBBadgeTier` / 격자 표시용 */
export const B_BADGE_TIERS = [1, 2, 3, 3, 3, 4, 4, 5, 5] as const;

/** `pickBIndex`: `fnv32(base + 'B') % 100` 구간 가중치, 합 100 */
export const B_NICKNAME_WEIGHTS = [4, 8, 6, 6, 6, 20, 20, 15, 15] as const;

export const NICKNAME_B_COL_COUNT = 9;

export type BBadgeVariant =
  | 'ac'
  | 'wa'
  | 'tle'
  | 'ce'
  | 'rte'
  | 'muted';

export const B_BADGE_VARIANT_MAP: Record<string, BBadgeVariant> = {
  '맞았습니다!!': 'ac',
  '틀렸습니다': 'wa',
  '시간 초과': 'tle',
  '메모리 초과': 'tle',
  '출력 초과': 'tle',
  '컴파일 에러': 'ce',
  '런타임 에러': 'rte',
  '출력 형식이 잘못되었습니다': 'wa',
  '채점 준비 중': 'muted',
};
