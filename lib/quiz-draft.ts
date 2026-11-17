import { QUESTIONS } from './quiz-data.ts';

export const QUIZ_DRAFT_TTL = 24 * 60 * 60 * 1000;
export type QuizDraft = { version: 1; savedAt: number; answers: number[]; currentQ?: number; selectedOpt?: number | null };
// Drafts contain core answer indexes only: never OTPs, sessions or profile fields.
export function readQuizDraft(raw: string | null, now = Date.now()): QuizDraft | null {
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw);
    if (draft.version !== 1 || !Number.isFinite(draft.savedAt) || draft.savedAt > now ||
      now - draft.savedAt >= QUIZ_DRAFT_TTL || !Array.isArray(draft.answers) ||
      draft.answers.length >= QUESTIONS.length || !draft.answers.every((answer: unknown, index: number) =>
        Number.isInteger(answer) && Number(answer) >= -1 && Number(answer) < QUESTIONS[index].opts.length)) return null;
    const result: QuizDraft = { version: 1, savedAt: draft.savedAt, answers: [...draft.answers] };
    // Earlier drafts only contain completed answers. New drafts also retain the
    // visible selection, even before Next, without committing it to scoring.
    if (draft.currentQ !== undefined || draft.selectedOpt !== undefined) {
      if (!Number.isInteger(draft.currentQ) || draft.currentQ < 0 ||
        draft.currentQ > draft.answers.length || draft.currentQ >= QUESTIONS.length ||
        (draft.selectedOpt !== null && (!Number.isInteger(draft.selectedOpt) ||
          draft.selectedOpt < 0 || draft.selectedOpt >= QUESTIONS[draft.currentQ].opts.length))) return null;
      result.currentQ = draft.currentQ;
      result.selectedOpt = draft.selectedOpt;
    }
    return result;
  } catch { return null; }
}

export async function quizDraftKey(email: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email.trim().toLowerCase()));
  return 'nc-core-draft-v1-' + Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
}
