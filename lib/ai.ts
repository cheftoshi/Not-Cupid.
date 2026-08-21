// One thin, server-only wrapper around the OpenAI Responses API. Every
// generative feature uses the same privacy, timeout and structured-output
// defaults. Callers must treat null as "AI unavailable" and use a curated
// fallback so the product never depends on a successful model request.

import { createHash } from 'node:crypto';
import OpenAI from 'openai';

export const AI_DEFAULT_MODEL = process.env.AI_CONCIERGE_MODEL || 'gpt-5.6-luna';
export const AI_EMBEDDING_MODEL = process.env.AI_EMBEDDING_MODEL || 'text-embedding-3-small';
export const AI_EMBEDDING_DIMENSIONS = 384;

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

export type GeneratedEmbedding = {
  embedding: number[];
  model: string;
  dimensions: number;
  promptTokens: number;
};

// Embeddings use the same server-only client, bounded retry policy and
// privacy-safe user identifier as the concierge. Keeping dimensions fixed is
// important because PostgreSQL vector columns have a declared dimension.
export async function generateEmbedding(opts: {
  input: string;
  model?: string;
  dimensions?: number;
  safetyIdentifier?: string;
}): Promise<GeneratedEmbedding | null> {
  if (!aiEnabled()) return null;
  const input = opts.input.trim();
  const model = opts.model ?? AI_EMBEDDING_MODEL;
  const dimensions = opts.dimensions ?? AI_EMBEDDING_DIMENSIONS;
  if (!input || input.length > 12_000) return null;
  if (!model.startsWith('text-embedding-3-') || dimensions !== AI_EMBEDDING_DIMENSIONS) {
    console.error('[ai] rejected incompatible embedding configuration');
    return null;
  }
  try {
    const response = await getClient().embeddings.create({
      model,
      input,
      dimensions,
      encoding_format: 'float',
      user: opts.safetyIdentifier,
    });
    const embedding = response.data[0]?.embedding;
    if (!Array.isArray(embedding)
      || embedding.length !== dimensions
      || embedding.some((value) => !Number.isFinite(value))) return null;
    return {
      embedding,
      model: response.model || model,
      dimensions,
      promptTokens: response.usage?.prompt_tokens ?? 0,
    };
  } catch (error) {
    console.error('[ai] embedding request failed:', error instanceof Error ? error.message : 'unknown');
    return null;
  }
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
