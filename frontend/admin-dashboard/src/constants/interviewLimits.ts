/** Align with backend `utils.interview_limits` — count-mode question cap. */
export const MAX_COUNT_MODE_QUESTIONS = 100;
export const MIN_INTERVIEW_QUESTIONS = 1;

export function clampCountModeQuestions(raw: unknown, fallback = 5): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return Math.max(MIN_INTERVIEW_QUESTIONS, Math.min(MAX_COUNT_MODE_QUESTIONS, fallback));
  return Math.max(MIN_INTERVIEW_QUESTIONS, Math.min(MAX_COUNT_MODE_QUESTIONS, Math.round(n)));
}
