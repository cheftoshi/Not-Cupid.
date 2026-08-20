import { supabaseAdmin } from '@/lib/supabase';
import { CHAT_INACTIVITY_MS, MAX_CONNECTIONS, syncMatchRosters } from '@/lib/match-actions';

type WinnerDraw = {
  id: string;
  user_a_id: string;
  user_b_id: string;
  love_match_id?: string | null;
};

export async function ensureDatingExperimentWinnerChats(draws: WinnerDraw[]): Promise<Map<string, string>> {
  const matchByDraw = new Map<string, string>();
  for (const draw of draws) {
    if (draw.love_match_id) {
      matchByDraw.set(draw.id, draw.love_match_id);
      continue;
    }
    const { data, error } = await supabaseAdmin.rpc('activate_dating_experiment_winner_chat', {
      p_draw_id: draw.id,
      p_chat_expires_at: new Date(Date.now() + CHAT_INACTIVITY_MS).toISOString(),
      p_max_connections: MAX_CONNECTIONS,
    });
    if (error) throw error;
    if (typeof data !== 'string') throw new Error('Dating Experiment winner chat activation returned no match.');
    matchByDraw.set(draw.id, data);
    await syncMatchRosters([draw.user_a_id, draw.user_b_id]);
  }
  return matchByDraw;
}
