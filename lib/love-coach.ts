export type LoveCoachStage = 'opener' | 'wait' | 'reply' | 'deepen' | 'plan';

export type LoveCoach = {
  stage: LoveCoachStage;
  headline: string;
  why: string;
  openers: string[];
  nextMove: string;
  source: 'ai' | 'curated';
  disclosure: string;
};

const genericOpeners = [
  'what’s something you’ve been weirdly excited about lately?',
  'what does a genuinely good weekend look like for you?',
  'quick chemistry test: planned night out or spontaneous adventure?',
];

export function loveCoachStage(
  currentUserId: string,
  messages: Array<{ sender_id: string }>,
): LoveCoachStage {
  if (messages.length === 0) return 'opener';
  const mine = messages.some((message) => message.sender_id === currentUserId);
  const theirs = messages.some((message) => message.sender_id !== currentUserId);
  if (mine && !theirs) return 'wait';
  if (!mine && theirs) return 'reply';
  if (messages.length < 6) return 'deepen';
  return 'plan';
}

export function curatedLoveCoach(input: {
  stage: LoveCoachStage;
  firstName: string;
  reasons: string[];
  interests?: string[];
}): LoveCoach {
  const why = input.reasons.length
    ? input.reasons.slice(0, 2).join(' · ')
    : 'your overall profiles complement each other';
  const interest = input.interests?.find(Boolean);
  const contextual = interest
    ? `I need the honest version: what got you into ${interest}?`
    : genericOpeners[0];

  if (input.stage === 'wait') {
    return {
      stage: input.stage,
      headline: 'you made the first move.',
      why,
      openers: [],
      nextMove: `Give ${input.firstName} a little room to meet you halfway.`,
      source: 'curated',
      disclosure: 'AI-assisted when available. Nothing is sent automatically, and message contents are never shared with the model.',
    };
  }

  const stageCopy: Record<Exclude<LoveCoachStage, 'wait'>, { headline: string; nextMove: string }> = {
    opener: { headline: 'skip “hey.” start somewhere real.', nextMove: 'Pick one, make it sound like you, then send it.' },
    reply: { headline: 'meet their energy, then give them a hook.', nextMove: 'Answer what they sent, add one real detail, and bounce a question back.' },
    deepen: { headline: 'you have momentum. make it specific.', nextMove: 'Move from facts to a story, opinion, or playful disagreement.' },
    plan: { headline: 'the chat has done enough work.', nextMove: 'Suggest one small public plan with a specific day or time window.' },
  };
  const copy = stageCopy[input.stage];
  return {
    stage: input.stage,
    headline: copy.headline,
    why,
    openers: [contextual, ...genericOpeners].filter((value, index, all) => all.indexOf(value) === index).slice(0, 3),
    nextMove: copy.nextMove,
    source: 'curated',
    disclosure: 'AI-assisted when available. Nothing is sent automatically, and message contents are never shared with the model.',
  };
}
