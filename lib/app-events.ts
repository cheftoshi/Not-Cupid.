import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';

export type AppEventInput = {
  userId?: string | null;
  eventName: string;
  path?: string | null;
  surface?: string | null;
  matchId?: string | null;
  candidateId?: string | null;
  metricName?: string | null;
  durationMs?: number | null;
  metricValue?: number | null;
  rating?: 'good' | 'needs-improvement' | 'poor' | null;
  deviceClass?: 'phone' | 'tablet' | 'desktop' | 'unknown' | null;
  displayMode?: 'standalone' | 'minimal-ui' | 'fullscreen' | 'browser' | 'unknown' | null;
  sessionId?: string | null;
  dedupeKey?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};

const finite = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export async function recordAppEvent(event: AppEventInput): Promise<void> {
  const row = {
    user_id: event.userId || null,
    event_name: event.eventName.slice(0, 64),
    path: event.path?.slice(0, 200) || null,
    surface: event.surface?.slice(0, 64) || null,
    match_id: event.matchId || null,
    candidate_id: event.candidateId || null,
    metric_name: event.metricName?.slice(0, 64) || null,
    duration_ms: finite(event.durationMs) == null ? null : Math.max(0, Math.min(600000, Math.round(event.durationMs!))),
    metric_value: finite(event.metricValue),
    rating: event.rating || null,
    device_class: event.deviceClass || null,
    display_mode: event.displayMode || null,
    session_id: event.sessionId?.slice(0, 80) || null,
    dedupe_key: event.dedupeKey?.slice(0, 180) || null,
    metadata: event.metadata || {},
  };
  const { error } = await supabaseAdmin.from('app_client_events').insert(row);
  // A repeated beacon is expected after reconnect/navigation restoration.
  if (error && error.code !== '23505') console.error('recordAppEvent failed:', error.message);
}
