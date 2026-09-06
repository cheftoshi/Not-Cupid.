import 'server-only';
import { createHmac } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase';

export type ChatRealtimeKind = 'love' | 'friend-dm' | 'friend-circle' | 'friend-club' | 'friend-plan';

function topicSecret(): string {
  return process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_KEY || 'local-realtime-topic';
}

// Topics contain no database id or user information. Only an authorized API
// response gives a participant this opaque capability; broadcasts carry a
// refresh signal, never a message body.
export function chatRealtimeTopic(kind: ChatRealtimeKind, entityId: string): string {
  const digest = createHmac('sha256', topicSecret()).update(`${kind}:${entityId}`).digest('hex').slice(0, 32);
  return `chat:${kind}:${digest}`;
}

export async function broadcastChatRefresh(kind: ChatRealtimeKind, entityId: string): Promise<void> {
  const channel = supabaseAdmin.channel(chatRealtimeTopic(kind, entityId), {
    config: { broadcast: { self: false }, private: false },
  });
  try {
    const result = await channel.send({
      type: 'broadcast',
      event: 'refresh',
      payload: { version: 1 },
    });
    if (result !== 'ok') console.warn('[chat-realtime] broadcast unavailable', { kind, result });
  } finally {
    await supabaseAdmin.removeChannel(channel).catch(() => undefined);
  }
}
