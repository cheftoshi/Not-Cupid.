'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';

let realtimeClient: SupabaseClient | null = null;

function client(): SupabaseClient | null {
  if (realtimeClient) return realtimeClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  realtimeClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return realtimeClient;
}

export function useChatRealtime(topic: string | null | undefined, refresh: () => void) {
  const refreshRef = useRef(refresh);
  const [connectedTopic, setConnectedTopic] = useState<string | null>(null);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);

  useEffect(() => {
    if (!topic) return;
    let supabase: SupabaseClient | null = null;
    let channel: RealtimeChannel | undefined;
    let stopped = false;
    let debounce: number | undefined;
    setConnectedTopic(null);
    try {
      supabase = client();
      if (!supabase) return;
      channel = supabase
      .channel(topic, { config: { broadcast: { self: false }, private: false } })
      .on('broadcast', { event: 'refresh' }, () => {
        if (debounce) window.clearTimeout(debounce);
        debounce = window.setTimeout(() => refreshRef.current(), 80);
      });
      channel.subscribe((status) => {
        if (stopped) return;
        setConnectedTopic(status === 'SUBSCRIBED' ? topic : null);
        // Heal messages missed while disconnected as soon as we rejoin.
        if (status === 'SUBSCRIBED') refreshRef.current();
      });
    } catch {
      // A denied WebSocket must never crash the chat. HTTP polling remains
      // authoritative and stays fast until a subscription actually succeeds.
      setConnectedTopic(null);
      if (supabase && channel) void supabase.removeChannel(channel).catch(() => {});
    }
    return () => {
      stopped = true;
      if (debounce) window.clearTimeout(debounce);
      if (supabase && channel) void supabase.removeChannel(channel).catch(() => {});
    };
  }, [topic]);
  return !!topic && connectedTopic === topic;
}
