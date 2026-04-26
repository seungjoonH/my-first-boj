export type SearchMode = 'first' | 'correct' | 'wrong';
export type SearchStrategy = 'binary' | 'ternary' | 'top1_prev';
export type ResultColor = 'ac' | 'pe' | 'wa' | 'tle' | 'mle' | 'ole' | 'rte' | 'ce' | 're';

export type SubmissionResult = {
  submissionId: string;
  problemId: string;
  problemTitle: string;
  submittedAt: string;
  language: string;
  result: string;
  resultColor: ResultColor;
};

/** BOJ status 한 페이지 파싱 결과 (`/api/search` 파서와 공유) */
export type ParsedPage = {
  rowCount: number;
  firstSubmissionId: string | null;
  lastRow: SubmissionResult | null;
  lastNonAcRow: SubmissionResult | null;
  hasNonAc: boolean;
  /** `span.result-text[data-color="ac"]` 가 한 행이라도 있는지 */
  hasAc: boolean;
};

export type HistoryEntry = {
  userId: string;
  mode: SearchMode;
  percent: number;
  completedAt: number | null;
};

export type SseEvent =
  | { type: 'progress'; percent: number }
  | ({ type: 'result' } & SubmissionResult)
  | { type: 'empty' }
  | { type: 'ended' }
  | { type: 'error'; message: string }
  | { type: 'rate_limit'; remainingSeconds: number }
  | { type: 'concurrency_limit'; failureCount: number };
