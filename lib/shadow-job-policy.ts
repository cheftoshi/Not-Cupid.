import { createHash } from 'node:crypto';

export type ShadowJobInput = {
  userId: string; intent: 'love' | 'friend'; liveAlgorithmVersion: string;
  liveTopIds: string[]; eligibleCandidateIds: string[];
  metro?: string | null; acquisitionSource?: string | null;
};

export function shadowJobKey(input: ShadowJobInput, now = new Date()): string {
  return createHash('sha256').update(JSON.stringify([
    now.toISOString().slice(0,10), input.userId, input.intent, input.liveAlgorithmVersion,
    input.liveTopIds, [...new Set(input.eligibleCandidateIds)].sort(),
  ])).digest('hex');
}

export function shadowJobOutcome(status: string, attempts: number) {
  if (status === 'recorded') return 'done';
  if (status === 'skipped' || status === 'disabled') return 'skipped';
  return attempts >= 3 ? 'failed' : 'pending';
}
