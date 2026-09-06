'use client';

import { useEffect, useRef } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);

  useEffect(() => {
    const supabase = client();
    if (!supabase || !topic) return;
    let debounce: number | undefined;
    const channel = supabase
      .channel(topic, { config: { broadcast: { self: false }, private: false } })
      .on('broadcast', { event: 'refresh' }, () => {
        if (debounce) window.clearTimeout(debounce);
        debounce = window.setTimeout(() => refreshRef.current(), 80);
      })
      .subscribe();
    return () => {
      if (debounce) window.clearTimeout(debounce);
      void supabase.removeChannel(channel);
    };
  }, [topic]);
}
