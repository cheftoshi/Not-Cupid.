// One thin, server-only wrapper around the OpenAI Responses API. Every
// generative feature uses the same privacy, timeout and structured-output
// defaults. Callers must treat null as "AI unavailable" and use a curated
// fallback so the product never depends on a successful model request.

import { createHash } from 'node:crypto';
import OpenAI from 'openai';

export const AI_DEFAULT_MODEL = process.env.AI_CONCIERGE_MODEL || 'gpt-5.6-luna';

let client: OpenAI | null = null;

export function aiEnabled(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 1,
      timeout: 12_000,
    });
  }
  return client;
}

// OpenAI recommends a stable, privacy-preserving identifier for abuse
// prevention. Hashing the internal UUID keeps names and emails out of it.
export function privacySafeAiUserId(userId: string): string {
  return createHash('sha256').update(`notcupid-ai:${userId}`).digest('hex');
}

// Generate a JSON object that strictly matches `schema`. The request is
// stateless (`store:false`), low-reasoning and server-side only. No prompt or
// model output is logged on failure.
export async function generateStructured<T>(opts: {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
  model?: string;
  safetyIdentifier?: string;
}): Promise<T | null> {
  if (!aiEnabled()) return null;
  const model = opts.model ?? AI_DEFAULT_MODEL;
  try {
    const response = await getClient().responses.create({
      model,
      instructions: opts.system,
      input: opts.user,
      max_output_tokens: opts.maxTokens ?? 700,
      reasoning: { effort: 'low' },
      text: {
        verbosity: 'low',
        format: {
          type: 'json_schema',
          name: 'notcupid_structured_response',
          strict: true,
          schema: opts.schema,
        },
      },
      safety_identifier: opts.safetyIdentifier,
      store: false,
    });
    if (!response.output_text) return null;
    return JSON.parse(response.output_text) as T;
  } catch (error) {
    const failure = error as { status?: number; code?: string; type?: string };
    console.error('[ai] structured generation failed', {
      provider: 'openai',
      model,
      status: failure.status,
      code: failure.code,
      type: failure.type,
    });
    return null;
  }
}
