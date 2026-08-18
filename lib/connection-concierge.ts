// Bumped when the disclosed AI processor changed so an earlier consent cannot
// silently authorize a new data boundary.
export const HUB_CONCIERGE_VERSION = 'hub-concierge-openai-v2-2026-08-18';
export const HUB_CONCIERGE_RANKER_VERSION = 'hub-action-policy-v1';
export const HUB_CONCIERGE_EXPLANATION_VERSION = 'hub-concierge-copy-openai-v2';

export type ConciergeIntent =
  | 'love'
  | 'friendship'
  | 'plan'
  | 'community'
  | 'travel'
  | 'profile'
  | 'general';

export type ConciergeAction =
  | 'open_profile'
  | 'open_core_quiz'
  | 'open_love_setup'
  | 'open_love_roster'
  | 'open_match'
  | 'join_friend_line'
  | 'open_friend_home'
  | 'open_friend_pack'
  | 'open_friend_chat'
  | 'open_friend_plan'
  | 'open_friend_scene'
  | 'open_communities'
  | 'open_travel'
  | 'none';

export type ConciergeLoveOption = {
  id: string;
  name: string;
  state: 'needs_answer' | 'chat_open' | 'waiting';
};

export type ConciergeFriendOption = { id: string; name: string };
export type ConciergePlanOption = {
  id: string;
  title: string;
  category: string | null;
  area: string | null;
  when: string | null;
  going: number;
};

export type ConciergeInventory = {
  firstName: string;
  city: string;
  archetype: string | null;
  interests: string[];
  profileReady: boolean;
  hasArchetype: boolean;
  needsLoveDeep: boolean;
  friendOptedIn: boolean;
  isTraveling: boolean;
  sealedFriendCount: number;
  love: ConciergeLoveOption[];
  friends: ConciergeFriendOption[];
  plans: ConciergePlanOption[];
};

export type ConciergeRecommendation = {
  intent: ConciergeIntent;
  message: string;
  cta: string;
  action: ConciergeAction;
  target: string;
  reasonCodes: string[];
  confidence: 'low' | 'medium' | 'high';
  source: 'ai' | 'curated';
  href: string | null;
  recommendationId?: string | null;
};

const INTENTS = new Set<ConciergeIntent>(['love', 'friendship', 'plan', 'community', 'travel', 'profile', 'general']);
const ACTIONS = new Set<ConciergeAction>([
  'open_profile', 'open_core_quiz', 'open_love_setup', 'open_love_roster', 'open_match',
  'join_friend_line', 'open_friend_home', 'open_friend_pack', 'open_friend_chat',
  'open_friend_plan', 'open_friend_scene', 'open_communities', 'open_travel', 'none',
]);

export function cleanConciergeText(value: unknown, max = 360): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}
export function conciergeIntentFromText(value: string): ConciergeIntent {
  const text = value.toLowerCase();
  if (/profile|bio|photo|prompt|quiz|personality/.test(text)) return 'profile';
  if (/travel|trip|visit|visiting|new city|out of town|vacation/.test(text)) return 'travel';
  if (/community|communities|club|discord|book club|run club|group/.test(text)) return 'community';
  if (/date|dating|love|romance|romantic|match|partner|relationship/.test(text)) return 'love';
  if (/friend|friendship|crew|buddy|people to meet/.test(text)) return 'friendship';
  if (/tonight|weekend|plan|event|activity|things to do|something to do|go out|near me|around me/.test(text)) return 'plan';
  return 'general';
}

function recommendation(
  inventory: ConciergeInventory,
  input: Omit<ConciergeRecommendation, 'source' | 'href'>,
): ConciergeRecommendation {
  return {
    ...input,
    source: 'curated',
    href: conciergeHref(input.action, input.target, inventory),
  };
}

function loveFallback(inventory: ConciergeInventory): ConciergeRecommendation {
  if (!inventory.hasArchetype) return recommendation(inventory, {
    intent: 'love', message: 'Your core quiz is the first useful move. Once that is in, I can route you toward reciprocal Love options instead of guessing.',
    cta: 'take the core quiz', action: 'open_core_quiz', target: '', reasonCodes: ['profile_gate', 'reciprocal_matching'], confidence: 'high',
  });
  if (inventory.needsLoveDeep) return recommendation(inventory, {
    intent: 'love', message: 'Finish the Love setup so I can use your relationship preferences and connection style before suggesting anyone.',
    cta: 'finish Love setup', action: 'open_love_setup', target: '', reasonCodes: ['love_setup', 'preference_accuracy'], confidence: 'high',
  });
  const needsAnswer = inventory.love.find((option) => option.state === 'needs_answer');
  if (needsAnswer) return recommendation(inventory, {
    intent: 'love', message: `${needsAnswer.name} is waiting on your decision. Answering that is the cleanest next move before opening another thread.`,
    cta: `answer ${needsAnswer.name}`, action: 'open_match', target: needsAnswer.id, reasonCodes: ['decision_waiting', 'reciprocal_momentum'], confidence: 'high',
  });
  const openChat = inventory.love.find((option) => option.state === 'chat_open');
  if (openChat) return recommendation(inventory, {
    intent: 'love', message: `You and ${openChat.name} already chose each other. The highest-value move is continuing that real conversation.`,
    cta: `open ${openChat.name}`, action: 'open_match', target: openChat.id, reasonCodes: ['mutual_connection', 'conversation_ready'], confidence: 'high',
  });
  const waiting = inventory.love.find((option) => option.state === 'waiting');
  if (waiting) return recommendation(inventory, {
    intent: 'love', message: `Your choice is with ${waiting.name} now. You can check that connection, while the rest of your roster stays available to browse.`,
    cta: 'check Love Line', action: 'open_love_roster', target: '', reasonCodes: ['choice_pending', 'roster_available'], confidence: 'medium',
  });
  return recommendation(inventory, {
    intent: 'love', message: 'Your Love roster is the best place to start. Every basic profile is open, and you stay in control of who receives a connection.',
    cta: 'open Love roster', action: 'open_love_roster', target: '', reasonCodes: ['roster_ready', 'user_control'], confidence: 'medium',
  });
}

function friendFallback(inventory: ConciergeInventory): ConciergeRecommendation {
  if (!inventory.friendOptedIn) return recommendation(inventory, {
    intent: 'friendship', message: 'Join Friend Line first, then I can route you toward people, plans, and communities around your actual interests.',
    cta: 'set up Friend Line', action: 'join_friend_line', target: '', reasonCodes: ['friend_setup', 'local_inventory'], confidence: 'high',
  });
  if (inventory.sealedFriendCount > 0) return recommendation(inventory, {
    intent: 'friendship', message: `You already have ${inventory.sealedFriendCount} new ${inventory.sealedFriendCount === 1 ? 'person' : 'people'} waiting in a Friend pack. Open that before asking the system to search wider.`,
    cta: 'open Friend pack', action: 'open_friend_pack', target: '', reasonCodes: ['people_waiting', 'fresh_inventory'], confidence: 'high',
  });
  const friend = inventory.friends[0];
  if (friend) return recommendation(inventory, {
    intent: 'friendship', message: `${friend.name} is already in your Friend circle. A specific hello or small plan has more value than another round of browsing.`,
    cta: `message ${friend.name}`, action: 'open_friend_chat', target: friend.id, reasonCodes: ['existing_connection', 'next_action'], confidence: 'medium',
  });
  return recommendation(inventory, {
    intent: 'friendship', message: 'Your Friend home can route one social signal into people, plans, and communities nearby. Start with what you would genuinely do.',
    cta: 'open Friend Line', action: 'open_friend_home', target: '', reasonCodes: ['intent_needed', 'local_routing'], confidence: 'medium',
  });
}

function planFallback(inventory: ConciergeInventory): ConciergeRecommendation {
  if (!inventory.friendOptedIn) return friendFallback(inventory);
  const plan = inventory.plans[0];
  if (plan) return recommendation(inventory, {
    intent: 'plan', message: `${plan.title} is a real option around ${plan.area || inventory.city}${plan.when ? ` ${plan.when}` : ''}. Open it and decide if it fits—nothing is joined automatically.`,
    cta: 'see this plan', action: 'open_friend_plan', target: plan.id, reasonCodes: ['real_inventory', 'local_now'], confidence: 'high',
  });
  return recommendation(inventory, {
    intent: 'plan', message: `Nothing concrete on your board is a confident fit yet. Open the ${inventory.city} Scene to browse what is live or start the plan you wish existed.`,
    cta: 'open the Scene', action: 'open_friend_scene', target: '', reasonCodes: ['inventory_thin', 'create_or_browse'], confidence: 'low',
  });
}

export function curatedConciergeRecommendation(message: string, inventory: ConciergeInventory): ConciergeRecommendation {
  const intent = conciergeIntentFromText(message);
  if (intent === 'love') return loveFallback(inventory);
  if (intent === 'friendship') return friendFallback(inventory);
  if (intent === 'plan') return planFallback(inventory);
  if (intent === 'community') {
    if (!inventory.friendOptedIn) return friendFallback(inventory);
    return recommendation(inventory, {
      intent, message: `Communities is the right lane for recurring groups, clubs, and local Discords around ${inventory.city}. I will take you straight there.`,
      cta: 'find communities', action: 'open_communities', target: '', reasonCodes: ['recurring_connection', 'local_community'], confidence: 'medium',
    });
  }
  if (intent === 'travel') {
    if (!inventory.friendOptedIn) return friendFallback(inventory);
    return recommendation(inventory, {
      intent, message: 'Travel mode can temporarily route Friend matches, plans, and communities to another metro without changing your home city.',
      cta: inventory.isTraveling ? 'manage my trip' : 'add a trip', action: 'open_travel', target: '', reasonCodes: ['travel_window', 'metro_routing'], confidence: 'high',
    });
  }
  if (intent === 'profile') return recommendation(inventory, {
    intent, message: inventory.profileReady
      ? 'Your core profile is live. You can still sharpen the photos, prompts, interests, and context people see before deciding.'
      : 'Your profile is the current bottleneck. Finish the exact missing basics before asking the system to route more people toward it.',
    cta: inventory.profileReady ? 'edit my profile' : 'finish my profile', action: 'open_profile', target: '', reasonCodes: ['profile_quality', 'trust_context'], confidence: 'high',
  });
  return recommendation(inventory, {
    intent: 'general', message: 'Tell me the outcome you want right now: a date, a friend, something to do, a community, or people in a city you are visiting.',
    cta: '', action: 'none', target: '', reasonCodes: ['clarification_needed'], confidence: 'low',
  });
}

export function conciergeHref(action: ConciergeAction, target: string, inventory: ConciergeInventory): string | null {
  if (action === 'open_match') return inventory.love.some((item) => item.id === target) ? `/match/${encodeURIComponent(target)}` : null;
  if (action === 'open_friend_chat') return inventory.friends.some((item) => item.id === target) ? `/friends?view=crew&dm=${encodeURIComponent(target)}` : null;
  if (action === 'open_friend_plan') return inventory.plans.some((item) => item.id === target) ? `/friends?view=scene&plan=${encodeURIComponent(target)}` : null;
  const routes: Partial<Record<ConciergeAction, string>> = {
    open_profile: '/profile?mode=edit&from=hub-concierge',
    open_core_quiz: '/quiz',
    open_love_setup: '/quiz?line=love',
    open_love_roster: '/dashboard',
    join_friend_line: '/friends/quiz',
    open_friend_home: '/friends',
    open_friend_pack: '/friends/pack',
    open_friend_scene: '/friends?view=scene',
    open_communities: '/friends?view=pulse',
    open_travel: '/friends?concierge=travel',
  };
  return routes[action] || null;
}

export function normalizeConciergeRecommendation(
  value: any,
  message: string,
  inventory: ConciergeInventory,
): ConciergeRecommendation {
  const fallback = curatedConciergeRecommendation(message, inventory);
  if (!value || !INTENTS.has(value.intent) || !ACTIONS.has(value.action)) return fallback;
  const action = value.action as ConciergeAction;
  const target = cleanConciergeText(value.target, 80);
  const href = conciergeHref(action, target, inventory);
  if (action !== 'none' && !href) return fallback;
  const body = cleanConciergeText(value.message, 420);
  if (!body) return fallback;
  const reasonCodes = Array.isArray(value.reasonCodes)
    ? value.reasonCodes.map((reason: unknown) => cleanConciergeText(reason, 40).toLowerCase().replace(/[^a-z0-9_]/g, '_')).filter(Boolean).slice(0, 3)
    : [];
  return {
    intent: value.intent,
    message: body,
    cta: action === 'none' ? '' : cleanConciergeText(value.cta, 40) || fallback.cta,
    action,
    target,
    reasonCodes: reasonCodes.length ? reasonCodes : fallback.reasonCodes,
    confidence: ['low', 'medium', 'high'].includes(value.confidence) ? value.confidence : 'medium',
    source: 'ai',
    href,
  };
}
