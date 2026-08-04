// ── AI helper — the concierge brain ─────────────────────────────────────────
// One thin server-side wrapper around the Anthropic Messages API. Everything
// AI-flavored in the app (today's move, future concierge surfaces) goes through
// claudeJSON() so there's exactly one place that knows about models, keys and
// structured output. Silent no-op when ANTHROPIC_API_KEY isn't set — callers
// must treat a null return as "AI unavailable" and fall back gracefully.

import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

export function aiEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

// Ask Claude for a JSON object matching `schema` (JSON Schema, strict — every
// object needs additionalProperties:false). Returns the parsed object or null
// on any failure (no key, API error, unparseable output) — never throws.
export async function claudeJSON<T>(opts: {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
  model?: string;
}): Promise<T | null> {
  if (!aiEnabled()) return null;
  try {
    const res = await getClient().messages.create({
      model: opts.model ?? 'claude-opus-4-8',
      max_tokens: opts.maxTokens ?? 700,
      system: opts.system,
      // Low effort: these are short, decided, copywriting-sized calls — latency
      // matters more than depth. json_schema output means no parse gymnastics.
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: opts.schema },
      },
      messages: [{ role: 'user', content: opts.user }],
    });
    const block = res.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') return null;
    return JSON.parse(block.text) as T;
  } catch (e) {
    console.error('claudeJSON failed:', e);
    return null;
  }
}
