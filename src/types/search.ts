export type SearchMode = 'first' | 'correct' | 'wrong';
export type SearchStrategy = 'binary' | 'ternary';
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
