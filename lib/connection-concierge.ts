// Bumped when the disclosed AI processor changed so an earlier consent cannot
// silently authorize a new data boundary.
export const HUB_CONCIERGE_VERSION = 'hub-concierge-openai-v3-2026-08-19';
export const HUB_CONCIERGE_RANKER_VERSION = 'hub-action-policy-v2';
export const HUB_CONCIERGE_EXPLANATION_VERSION = 'hub-concierge-copy-openai-v3';

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

export const CONNECTION_MEMORY_CATEGORIES = [
  'goal', 'preference', 'boundary', 'availability', 'location',
  'coaching_style', 'current_context',
] as const;
export type ConnectionMemoryCategory = typeof CONNECTION_MEMORY_CATEGORIES[number];
export type ConnectionMemorySuggestion = {
  shouldRemember: boolean;
  category: ConnectionMemoryCategory;
  key: string;
  value: string;
  expiresInDays: number;
};
export type ConnectionMemory = {
  id: string;
  category: ConnectionMemoryCategory;
  key: string;
  value: string;
  expiresAt: string | null;
};
export type ConciergeBrief = {
  headline: string;
  message: string;
  signals: string[];
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
  memorySuggestion?: ConnectionMemorySuggestion | null;
};

const INTENTS = new Set<ConciergeIntent>(['love', 'friendship', 'plan', 'community', 'travel', 'profile', 'general']);
const ACTIONS = new Set<ConciergeAction>([
  'open_profile', 'open_core_quiz', 'open_love_setup', 'open_love_roster', 'open_match',
  'join_friend_line', 'open_friend_home', 'open_friend_pack', 'open_friend_chat',
  'open_friend_plan', 'open_friend_scene', 'open_communities', 'open_travel', 'none',
]);
const MEMORY_CATEGORIES = new Set<ConnectionMemoryCategory>(CONNECTION_MEMORY_CATEGORIES);

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

export function connectionBrief(inventory: ConciergeInventory): ConciergeBrief {
  const needsAnswer = inventory.love.filter((option) => option.state === 'needs_answer');
  const openChats = inventory.love.filter((option) => option.state === 'chat_open');
  const waiting = inventory.love.filter((option) => option.state === 'waiting');
  const signals: string[] = [];
  if (needsAnswer.length) signals.push(`${needsAnswer.length} ${needsAnswer.length === 1 ? 'choice' : 'choices'} waiting`);
  if (openChats.length) signals.push(`${openChats.length} open ${openChats.length === 1 ? 'chat' : 'chats'}`);
  if (inventory.plans.length) signals.push(`${inventory.plans.length} nearby ${inventory.plans.length === 1 ? 'plan' : 'plans'}`);
  if (inventory.sealedFriendCount) signals.push(`${inventory.sealedFriendCount} new Friend ${inventory.sealedFriendCount === 1 ? 'connection' : 'connections'}`);
  if (!signals.length && waiting.length) signals.push(`${waiting.length} Love ${waiting.length === 1 ? 'choice' : 'choices'} pending`);

  if (needsAnswer[0]) return {
    headline: 'There is a real choice waiting.',
    message: `${needsAnswer[0].name} has already chosen you. You can answer that first, or tell me what kind of connection you want today.`,
    signals: signals.slice(0, 3),
  };
  if (openChats[0]) return {
    headline: 'You already have somewhere to start.',
    message: `Your conversation with ${openChats[0].name} is open${inventory.plans[0] ? `, and ${inventory.plans[0].title} is happening nearby` : ''}. Tell me what kind of next move would feel useful.`,
    signals: signals.slice(0, 3),
  };
  if (inventory.plans[0]) return {
    headline: `Here is what is moving around ${inventory.city}.`,
    message: `${inventory.plans[0].title} is one live option. Tell me who you want to meet or what you feel like doing, and I’ll narrow it down.`,
    signals: signals.slice(0, 3),
  };
  if (!inventory.profileReady) return {
    headline: 'Your next useful move is getting clearer.',
    message: 'Your profile still needs a few basics. I can help you finish it, or you can tell me what kind of connection you want first.',
    signals: ['profile needs attention'],
  };
  return {
    headline: `I’m looking across ${inventory.city} with you.`,
    message: 'Tell me what you want right now: someone to date, a new friend, a plan, or a community. I’ll give you one useful next move.',
    signals: signals.slice(0, 3),
  };
}

function memoryKey(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 54);
  return `memory-${slug || 'preference'}`;
}

function containsDirectIdentifier(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value)
    || /\bhttps?:\/\/|\bwww\./i.test(value)
    || /\b\d{3}-\d{2}-\d{4}\b/.test(value)
    || /\b\d{5}(?:-\d{4})?\b/.test(value)
    || digits.length >= 7
    || /\b(?:password|passcode|api[_ -]?key|secret|token)\b\s*[:=]/i.test(value);
}

export function explicitMemorySuggestion(message: string): ConnectionMemorySuggestion | null {
  const match = cleanConciergeText(message, 400).match(/^remember(?:\s+that)?\s+(.{3,240})$/i);
  if (!match) return null;
  const value = cleanConciergeText(match[1], 240);
  if (!value) return null;
  return normalizeConnectionMemorySuggestion({
    shouldRemember: true,
    category: 'preference',
    key: memoryKey(value),
    value,
    expiresInDays: 0,
  });
}

export function normalizeConnectionMemorySuggestion(value: any): ConnectionMemorySuggestion | null {
  if (!value || value.shouldRemember !== true || !MEMORY_CATEGORIES.has(value.category)) return null;
  const memoryValue = cleanConciergeText(value.value, 240);
  if (!memoryValue || containsDirectIdentifier(memoryValue)) return null;
  const rawKey = cleanConciergeText(value.key, 80).toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const expires = Number.isFinite(value.expiresInDays) ? Math.round(value.expiresInDays) : 0;
  return {
    shouldRemember: true,
    category: value.category,
    key: rawKey || memoryKey(memoryValue),
    value: memoryValue,
    expiresInDays: Math.max(0, Math.min(3650, expires)),
  };
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
    memorySuggestion: normalizeConnectionMemorySuggestion(value.memorySuggestion),
  };
}
