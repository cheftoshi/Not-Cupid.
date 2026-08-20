import 'server-only';

import { createHash } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase';
import {
  normalizeConnectionMemorySuggestion,
  type ConnectionMemory,
  type ConnectionMemorySuggestion,
} from '@/lib/connection-concierge';

function memoryRow(row: any): ConnectionMemory {
  return {
    id: String(row.id),
    category: row.category,
    key: String(row.memory_key),
    value: String(row.memory_value),
    expiresAt: row.expires_at || null,
  };
}

export async function loadConnectionMemories(userId: string): Promise<ConnectionMemory[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('connection_memories')
    .select('id, category, memory_key, memory_value, expires_at, updated_at')
    .eq('user_id', userId)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('updated_at', { ascending: false })
    .limit(12);
  if (error) {
    // The Hub remains usable while a new migration is rolling out.
    console.error('[concierge] memory read failed:', error.message);
    return [];
  }
  return (data || []).map(memoryRow);
}

export async function saveConnectionMemory(
  userId: string,
  raw: unknown,
): Promise<ConnectionMemory | null> {
  const suggestion = normalizeConnectionMemorySuggestion(raw);
  if (!suggestion?.shouldRemember) return null;
  const nowIso = new Date().toISOString();
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('connection_memories')
    .select('id')
    .eq('user_id', userId)
    .eq('memory_key', suggestion.key)
    .maybeSingle();
  if (existingError) {
    console.error('[concierge] memory lookup failed:', existingError.message);
    return null;
  }
  if (!existing) {
    const { count, error: countError } = await supabaseAdmin
      .from('connection_memories')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`);
    if (countError) {
      console.error('[concierge] memory count failed:', countError.message);
      return null;
    }
    if ((count ?? 0) >= 12) return null;
  }
  const expiresAt = suggestion.expiresInDays > 0
    ? new Date(Date.now() + suggestion.expiresInDays * 86_400_000).toISOString()
    : null;
  const { data, error } = await supabaseAdmin.from('connection_memories').upsert({
    user_id: userId,
    category: suggestion.category,
    memory_key: suggestion.key,
    memory_value: suggestion.value,
    source: 'user_confirmed',
    expires_at: expiresAt,
    confirmed_at: nowIso,
    updated_at: nowIso,
  }, { onConflict: 'user_id,memory_key' }).select('id, category, memory_key, memory_value, expires_at').single();
  if (error) {
    console.error('[concierge] memory write failed:', error.message);
    return null;
  }
  return memoryRow(data);
}

export async function forgetConnectionMemory(userId: string, memoryId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from('connection_memories')
    .delete()
    .eq('id', memoryId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('[concierge] memory delete failed:', error.message);
    return false;
  }
  return !!data;
}

export function memoriesForModel(memories: ConnectionMemory[]): Array<Pick<ConnectionMemorySuggestion, 'category' | 'value'>> {
  return memories.slice(0, 12).map(({ category, value }) => ({ category, value }));
}

export function connectionMemoryFingerprint(memories: ConnectionMemory[]): string {
  const canonical = memoriesForModel(memories)
    .map(({ category, value }) => `${category}:${value}`)
    .sort()
    .join('|');
  return createHash('sha256').update(`connection-memory-v1:${canonical}`).digest('hex').slice(0, 16);
}
