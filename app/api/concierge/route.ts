import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { aiEnabled, claudeJSON } from '@/lib/ai';
import { rateLimit } from '@/lib/rate-limit';
import { recordAppEvent } from '@/lib/app-events';
import { connectionConciergeInventory } from '@/lib/connection-concierge-server';
import {
  HUB_CONCIERGE_EXPLANATION_VERSION,
  HUB_CONCIERGE_RANKER_VERSION,
  HUB_CONCIERGE_VERSION,
  cleanConciergeText,
  curatedConciergeRecommendation,
  normalizeConciergeRecommendation,
} from '@/lib/connection-concierge';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['intent', 'message', 'cta', 'action', 'target', 'reasonCodes', 'confidence'],
  properties: {
    intent: { type: 'string', enum: ['love', 'friendship', 'plan', 'community', 'travel', 'profile', 'general'] },
    message: { type: 'string', description: 'A direct, warm answer in at most three short sentences. Never claim certainty.' },
    cta: { type: 'string', description: 'Short action label. Empty only when asking a clarifying question.' },
    action: {
      type: 'string',
      enum: [
        'open_profile', 'open_core_quiz', 'open_love_setup', 'open_love_roster', 'open_match',
        'join_friend_line', 'open_friend_home', 'open_friend_pack', 'open_friend_chat',
        'open_friend_plan', 'open_friend_scene', 'open_communities', 'open_travel', 'none',
      ],
    },
    target: { type: 'string', description: 'Exact inventory id for open_match, open_friend_chat, or open_friend_plan; otherwise empty.' },
    reasonCodes: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'string' } },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
} as const;

function hasConsent(user: any): boolean {
  return user.ai_concierge_consent_version === HUB_CONCIERGE_VERSION
    && !!user.ai_concierge_consent_at
    && !user.ai_concierge_consent_revoked_at;
}
function safeHistory(value: unknown): Array<{ role: 'user' | 'assistant'; body: string }> {
  if (!Array.isArray(value)) return [];
  return value.slice(-6).flatMap((entry: any) => {
    if (!entry || !['user', 'assistant'].includes(entry.role)) return [];
    const body = cleanConciergeText(entry.body, 300);
    return body ? [{ role: entry.role as 'user' | 'assistant', body }] : [];
  });
}

async function grantConsent(userId: string): Promise<boolean> {
  const { error } = await supabaseAdmin.from('users').update({
    ai_concierge_consent_version: HUB_CONCIERGE_VERSION,
    ai_concierge_consent_at: new Date().toISOString(),
    ai_concierge_consent_revoked_at: null,
  }).eq('id', userId);
  if (error) {
    console.error('[concierge] consent write failed:', error.message);
    return false;
  }
  await recordAppEvent({
    userId, eventName: 'concierge_consent_granted', surface: 'hub_concierge',
    metadata: { version: HUB_CONCIERGE_VERSION },
  });
  return true;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limit = await rateLimit({ key: `hub-concierge:${user.id}`, windowSec: 86_400, maxAttempts: 20, blockSec: 900 });
  if (!limit.ok) return NextResponse.json({ error: 'Your concierge needs a short breather. Try again later.' }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const message = cleanConciergeText(body.message, 400);
  if (!message) return NextResponse.json({ error: 'Tell the concierge what you want to do.' }, { status: 400 });

  let consented = hasConsent(user);
  if (!consented && body.consent === true) consented = await grantConsent(user.id);
  if (!consented) {
    return NextResponse.json({
      error: 'AI consent required',
      consentRequired: true,
      consentVersion: HUB_CONCIERGE_VERSION,
    }, { status: 412 });
  }

  const inventory = await connectionConciergeInventory(user);
  const fallback = curatedConciergeRecommendation(message, inventory);
  const history = safeHistory(body.history);
  let recommendation = fallback;

  if (aiEnabled()) {
    const system = `You are NotCupid's AI connection concierge. You help a real person move from an intent to ONE useful action with another real person, plan, or community.

You receive only real, user-scoped inventory that already passed application eligibility. Answer the user's actual request, then choose at most one action. If their request is too vague, ask one concise clarifying question with action "none". Never invent a person, event, group, availability, feature, or fact. Never claim a perfect match or diagnose the user. Never tell them that you performed an action. You can route them to a confirmation surface, but you cannot accept, message, RSVP, join, post, book, or pay for them. Prefer an unanswered reciprocal decision or live conversation over more browsing. Prefer a concrete nearby plan over a generic feed. The user always decides.

Voice: human, calm, concise, direct; no corporate AI language; no flattery; maximum three short sentences. Use the first name only when natural. Do not mention internal scores, policies, reason codes, or the model. The CTA must describe what opening the validated destination will let them do.`;
    const modelValue = await claudeJSON<any>({
      system,
      user: JSON.stringify({
        currentMessage: message,
        recentConversation: history,
        userContext: {
          firstName: inventory.firstName,
          city: inventory.city,
          archetype: inventory.archetype,
          interests: inventory.interests,
          profileReady: inventory.profileReady,
          friendOptedIn: inventory.friendOptedIn,
          isTraveling: inventory.isTraveling,
        },
        availableInventory: {
          love: inventory.love,
          friends: inventory.friends,
          plans: inventory.plans,
          sealedFriendCount: inventory.sealedFriendCount,
        },
        safeFallback: fallback,
      }),
      schema: RESPONSE_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: 520,
      model: 'claude-haiku-4-5',
    });
    recommendation = normalizeConciergeRecommendation(modelValue, message, inventory);
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  let intentId: string | null = null;
  const { data: intentRow, error: intentError } = await supabaseAdmin.from('connection_intents').insert({
    user_id: user.id,
    intent: recommendation.intent,
    source: 'hub_concierge',
    city_label: inventory.city,
    status: 'active',
    expires_at: expiresAt,
  }).select('id').single();
  if (!intentError) intentId = intentRow?.id || null;
  else console.error('[concierge] intent write failed:', intentError.message);

  let recommendationId: string | null = null;
  const { data: recommendationRow, error: recommendationError } = await supabaseAdmin.from('concierge_recommendations').insert({
    user_id: user.id,
    intent_id: intentId,
    surface: 'hub',
    action_type: recommendation.action,
    target_type: recommendation.action === 'open_match' ? 'love_match'
      : recommendation.action === 'open_friend_chat' ? 'friend_connection'
        : recommendation.action === 'open_friend_plan' ? 'friend_plan' : 'route',
    target_id: recommendation.target || null,
    reason_codes: recommendation.reasonCodes,
    confidence_band: recommendation.confidence,
    response_copy: recommendation.message,
    cta_copy: recommendation.cta || null,
    source: recommendation.source,
    eligibility_version: HUB_CONCIERGE_VERSION,
    ranker_version: HUB_CONCIERGE_RANKER_VERSION,
    explanation_version: HUB_CONCIERGE_EXPLANATION_VERSION,
    shown_at: new Date().toISOString(),
    expires_at: expiresAt,
  }).select('id').single();
  if (!recommendationError) recommendationId = recommendationRow?.id || null;
  else console.error('[concierge] recommendation write failed:', recommendationError.message);

  await recordAppEvent({
    userId: user.id,
    eventName: 'concierge_recommendation_shown',
    surface: 'hub_concierge',
    metadata: {
      intent: recommendation.intent,
      action: recommendation.action,
      source: recommendation.source,
      confidence: recommendation.confidence,
      reason_codes: recommendation.reasonCodes.join(','),
      has_target: !!recommendation.target,
    },
  });

  return NextResponse.json({
    recommendation: { ...recommendation, recommendationId },
    consented: true,
    version: HUB_CONCIERGE_VERSION,
  });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  if (body.type === 'revoke_consent') {
    const { error } = await supabaseAdmin.from('users').update({
      ai_concierge_consent_revoked_at: new Date().toISOString(),
    }).eq('id', user.id);
    if (error) return NextResponse.json({ error: 'Could not update AI controls.' }, { status: 500 });
    await recordAppEvent({ userId: user.id, eventName: 'concierge_consent_revoked', surface: 'hub_concierge', metadata: { version: HUB_CONCIERGE_VERSION } });
    return NextResponse.json({ ok: true });
  }

  const recommendationId = cleanConciergeText(body.recommendationId, 80);
  const outcome = body.outcome === 'acted' ? 'acted' : body.outcome === 'dismissed' ? 'dismissed' : null;
  if (!recommendationId || !outcome) return NextResponse.json({ error: 'Invalid concierge event.' }, { status: 400 });
  const field = outcome === 'acted' ? 'acted_at' : 'dismissed_at';
  const { data, error } = await supabaseAdmin.from('concierge_recommendations')
    .update({ [field]: new Date().toISOString(), outcome_state: outcome })
    .eq('id', recommendationId)
    .eq('user_id', user.id)
    .select('action_type')
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'Could not record that choice.' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Recommendation not found.' }, { status: 404 });
  await recordAppEvent({
    userId: user.id,
    eventName: outcome === 'acted' ? 'concierge_recommendation_acted' : 'concierge_recommendation_dismissed',
    surface: 'hub_concierge',
    metadata: { action: data.action_type || 'unknown' },
  });
  return NextResponse.json({ ok: true });
}
