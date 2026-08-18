export type ProfilePrompt = { question: string; answer: string };

export const PROFILE_PROMPT_OPTIONS = [
  'A tiny thing that makes my day is…',
  'The fastest way to win me over is…',
  'A very specific hill I will die on is…',
  'My ideal low-key first date is…',
  'I will never say no to…',
  'Something I want to learn this year is…',
  'The recommendation I always give is…',
  'We will get along if…',
] as const;

const allowed = new Set<string>(PROFILE_PROMPT_OPTIONS);

// The editor needs to retain a newly selected prompt while its answer is still
// blank. Persisted/rendered profiles should only expose completed prompts.
export function profilePromptDrafts(value: unknown): ProfilePrompt[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object' && !Array.isArray(entry))
    .map((entry) => ({
      question: typeof entry.question === 'string' ? entry.question.trim() : '',
      // Do not trim an in-progress answer. React re-runs this helper after
      // every keystroke; trimming here made a trailing space disappear as soon
      // as it was typed (most visibly on Android keyboards).
      answer: typeof entry.answer === 'string' ? entry.answer : '',
    }))
    .filter((entry) => {
      if (!allowed.has(entry.question) || entry.answer.length > 180 || seen.has(entry.question)) return false;
      seen.add(entry.question);
      return true;
    })
    .slice(0, 3);
}

export function normalizeProfilePrompts(value: unknown): ProfilePrompt[] {
  return profilePromptDrafts(value)
    .map((entry) => ({ ...entry, answer: entry.answer.trim() }))
    .filter((entry) => entry.answer.length > 0);
}
