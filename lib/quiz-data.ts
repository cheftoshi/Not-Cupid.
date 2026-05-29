export type Dimension = 
  | 'Honesty-Humility'
  | 'Emotionality'
  | 'Extraversion'
  | 'Agreeableness'
  | 'Conscientiousness'
  | 'Openness'

export interface Question {
  dim: Dimension
  short: string
  q: string
  opts: string[]
  score: number[]
}

export interface Archetype {
  name: string
  desc: string
  tag: string
}

export const DIMS: Dimension[] = [
  'Honesty-Humility','Emotionality','Extraversion','Agreeableness','Conscientiousness','Openness',
]

export const DIM_SHORT: Record<Dimension, string> = {
  'Honesty-Humility': 'Honesty',
  'Emotionality': 'Emotionality',
  'Extraversion': 'Extraversion',
  'Agreeableness': 'Agreeableness',
  'Conscientiousness': 'Conscientiousness',
  'Openness': 'Openness',
}

export const QUESTIONS: Question[] = [
  {
    dim: 'Honesty-Humility', short: 'Honesty',
    q: 'Your ex texts "hey" at 11pm. You:',
    opts: ["Leave it. I'm an adult.", '"Hey" back. Chaos is fun.', 'Screenshot first, decide later.', 'Already typing.'],
    score: [4, 2, 2, 1],
  },
  {
    dim: 'Honesty-Humility', short: 'Honesty',
    q: "You get credit for something that was 60% yours. Your colleague is in the room. You:",
    opts: ['Correct it out loud. Right now.', 'DM them after.', 'Say nothing. 60% is accurate.', 'Their fault for not speaking up.'],
    score: [4, 3, 1, 1],
  },
  {
    dim: 'Honesty-Humility', short: 'Honesty',
    q: "You're casually dating. They ask if you're talking to anyone else. You are. You say:",
    opts: ['Yes. We never said exclusive.', 'Vague answer, redirect.', 'No. Obviously no.', 'Ask them first.'],
    score: [4, 2, 1, 2],
  },
  {
    dim: 'Emotionality', short: 'Emotionality',
    q: "Sunday 4pm dread. What's it actually about?",
    opts: ['Something I said in 2019.', "A real worry I've ignored.", 'Just the vibe of Sunday.', "I don't get that. I'm fine."],
    score: [4, 3, 2, 1],
  },
  {
    dim: 'Emotionality', short: 'Emotionality',
    q: "Someone grabs your phone and your camera roll is open. Your reaction:",
    opts: ['Fine. Nothing shameful.', "Mild panic. It's just private.", "Hard grab-back. That's mine.", 'I deleted everything last week.'],
    score: [4, 3, 2, 1],
  },
  {
    dim: 'Emotionality', short: 'Emotionality',
    q: "Most accurate description of your sleep schedule:",
    opts: ['Asleep by 10. Built different.', 'Normal human hours, mostly.', '"Just one more episode."', 'Sleep is a suggestion.'],
    score: [3, 4, 2, 1],
  },
  {
    dim: 'Extraversion', short: 'Extraversion',
    q: "Friend cancels last minute. Plans were in the South End. You:",
    opts: ['Go solo. Underrated move.', 'Text someone else, pivot.', 'Go home. This is ideal.', 'Sit in the car, then go home.'],
    score: [4, 3, 2, 1],
  },
  {
    dim: 'Extraversion', short: 'Extraversion',
    q: '"We need to talk" lands in your DMs. Before you know what it\'s about, you:',
    opts: ['"When?" and move on.', 'Run the scenarios quickly.', 'Full spiral. Three drafts.', 'Go quiet and wait.'],
    score: [4, 3, 2, 1],
  },
  {
    dim: 'Extraversion', short: 'Extraversion',
    q: 'Group chat: "what are we doing tonight?" You:',
    opts: ['Three ideas with Yelp links.', 'One thing, commit hard.', '"Down for whatever."', '👍 and await instructions.'],
    score: [4, 3, 2, 1],
  },
  {
    dim: 'Agreeableness', short: 'Agreeableness',
    q: "Mid-debate you realize you're wrong. They don't know yet. You:",
    opts: ['"You\'re right." Out loud. Now.', 'Quietly shift, no announcement.', 'Finish my point, concede later.', 'Double down. Changing is weak.'],
    score: [4, 3, 2, 1],
  },
  {
    dim: 'Agreeableness', short: 'Agreeableness',
    q: "First date going well. They say something confidently wrong. You:",
    opts: ["Gently correct it. Can't let it stand.", 'Ask a question that leads them there.', "Let it go. It's date one.", 'Agree. Vibes are too good.'],
    score: [3, 4, 2, 1],
  },
  {
    dim: 'Agreeableness', short: 'Agreeableness',
    q: "Someone takes your Red Line seat. The one you literally just got up from. You:",
    opts: ['"That was mine." Civil but firm.', 'Extended eye contact. No words.', "Let it go. It's a seat.", 'This is why I Uber.'],
    score: [3, 2, 4, 1],
  },
  {
    dim: 'Conscientiousness', short: 'Conscientiousness',
    q: "Your Notes app is:",
    opts: ["Folders, color-coded. It's a system.", 'Useful stuff + 2am chaos.', 'One scroll of chaos I navigate.', 'Voice memos. Like a feral person.'],
    score: [4, 3, 2, 1],
  },
  {
    dim: 'Conscientiousness', short: 'Conscientiousness',
    q: "Week to do something. When do you start?",
    opts: ['Day one. Why wait?', 'Middle. Good buffer.', 'Day six. Pressure works.', 'Day seven, 11pm. Peak me.'],
    score: [4, 3, 2, 1],
  },
  {
    dim: 'Conscientiousness', short: 'Conscientiousness',
    q: "Being early is:",
    opts: ['Early is on time. Non-negotiable.', 'I aim for on time, usually make it.', "Slightly late. I've accepted this.", 'Time is a construct. I reject it.'],
    score: [4, 3, 2, 1],
  },
  {
    dim: 'Openness', short: 'Openness',
    q: '"Slow but rewarding" movie recommendation. You:',
    opts: ['Watch immediately. My genre.', 'List. Eventually.', 'How slow are we talking.', "Put on something I've seen before."],
    score: [4, 3, 2, 1],
  },
  {
    dim: 'Openness', short: 'Openness',
    q: "Uber driver wants to debate free will at 1am. You:",
    opts: ["Let's go. I have thoughts.", 'Engage then wind it down.', 'Short answers, pray it stops.', 'AirPods. Immediately.'],
    score: [4, 3, 2, 1],
  },
  {
    dim: 'Openness', short: 'Openness',
    q: "Your relationship with your own weirdness:",
    opts: ["Fully embraced. It's the point.", 'Aware of it. Selectively deploy.', 'I prefer "specific" to "weird."', "I'm not weird. I'm particular."],
    score: [4, 3, 2, 1],
  },
  // ─── added Q4 per dim to bring HEXACO to 24 total ─────────────
  {
    dim: 'Honesty-Humility', short: 'Honesty',
    q: 'Friend just dropped $250 on a cut from a Newbury salon. It is not it. They ask. You:',
    opts: ["Tell them. Kindly. They asked.", "Hint at it — 'interesting choice'.", 'Lie cleanly. Hair grows.', "Compliment the highlights and bail."],
    score: [4, 2, 1, 2],
  },
  {
    dim: 'Emotionality', short: 'Emotionality',
    q: "2am. The radiator in your apartment clanks like someone's in the wall. You:",
    opts: ["It's the radiator. I know my building.", "Pause, listen, move on.", "Phone in hand, lights on.", "Already googling 'is this a ghost'."],
    score: [4, 3, 2, 1],
  },
  {
    dim: 'Extraversion', short: 'Extraversion',
    q: 'House party in Allston. You know one person. They went out for a smoke. You:',
    opts: ['Find the kitchen, talk to whoever\'s in it.', 'Park near the snacks. Smile at people.', 'Text them: where are you?', "Step outside for 'air' and check the time."],
    score: [4, 3, 2, 1],
  },
  {
    dim: 'Agreeableness', short: 'Agreeableness',
    q: 'Bartender at the Beehive misses your order — twice. You:',
    opts: ['Wave them over, easy. People mess up.', "Lean in: 'still waiting on that one?'", "Catch the manager's eye.", "Stage-whisper to my table about it."],
    score: [4, 3, 2, 1],
  },
  {
    dim: 'Conscientiousness', short: 'Conscientiousness',
    q: "Your unread email count:",
    opts: ['Zero. I touch each one once.', 'Under fifty. Mostly handled.', "Three figures. I have a system, sort of.", 'Four-digit red dot. Do not open the app.'],
    score: [4, 3, 2, 1],
  },
  {
    dim: 'Openness', short: 'Openness',
    q: 'Friend wants to drag you to an experimental noise show at the Lily Pad in Inman. You:',
    opts: ['Already in. Worst case it\'s a story.', "Sure, if dinner's part of it.", "What does 'experimental noise' actually mean.", "Hard pass. I know what I like."],
    score: [4, 3, 2, 1],
  },
]

// ─── Relationship style: the SHAPE of the relationship the user wants
//     (marriage-track vs DINK vs ENM/poly vs casual). Stored on
//     users.relationship_style — separate from the "future" vibe which
//     is about timeline/seriousness. Single-select. Optional (nullable).
export type RelationshipStyle = 'marriage_track' | 'dink' | 'enm_poly' | 'casual' | 'open'

export const RELATIONSHIP_STYLES: Array<{
  value: RelationshipStyle
  short: string
  label: string
  desc: string
}> = [
  { value: 'marriage_track', short: 'marriage track', label: 'Marriage + kids in mind',
    desc: 'building toward a traditional partnership' },
  { value: 'dink',            short: 'DINK',          label: 'Long-term, no kids (DINK)',
    desc: 'committed pair, two incomes, no children by choice' },
  { value: 'enm_poly',        short: 'ENM / poly',    label: 'ENM / polyamorous',
    desc: 'ethical non-monogamy, multiple partners by agreement' },
  { value: 'casual',          short: 'casual',        label: 'Casual / right-now',
    desc: 'dating without long-term expectations' },
  { value: 'open',            short: 'open',          label: 'Open to anything',
    desc: 'no strong preference yet' },
]

export function relationshipStyleLabel(v: string | null | undefined): string | null {
  if (!v) return null
  return RELATIONSHIP_STYLES.find((s) => s.value === v)?.short ?? null
}

// ─── Vibes: 6 additional questions covering lifestyle/compat dimensions
//     that HEXACO doesn't capture (chronotype, date frequency, future scope,
//     communication mode, social radius, risk attitude). Stored as
//     user.vibes JSONB and factored into compatibilityScore at 20% weight.
export type VibeKey = 'chronotype' | 'date_freq' | 'future' | 'comm' | 'social' | 'risk'

export interface VibeQuestion {
  key: VibeKey
  short: string
  q: string
  opts: string[]
  // Each option maps to a 1..4 position on the dimension's spectrum.
  // Similarity (|a - b|) is computed across all 6 dimensions and inverted into a score.
  score: number[]
}

export const VIBE_QUESTIONS: VibeQuestion[] = [
  {
    key: 'chronotype', short: 'Day rhythm',
    q: 'When are you actually the best version of yourself?',
    opts: ['7am, post-coffee, before the world.', 'Mid-morning to early afternoon.', 'Late afternoon golden hour.', 'After 10pm. Always.'],
    score: [1, 2, 3, 4],
  },
  {
    key: 'date_freq', short: 'How often',
    q: "You're dating someone you like. How often do you want to see them?",
    opts: ['Most days. I get attached.', '3–4 times a week feels right.', 'Once or twice. I like my space.', 'When it happens it happens.'],
    score: [4, 3, 2, 1],
  },
  {
    key: 'future', short: 'Where this is going',
    q: 'Big-picture, what are you looking for?',
    opts: ['Marriage + kids, eventually.', 'Long-term partner, kids are tbd.', "Serious but not 'plan-the-wedding' serious.", 'Something real for right now, no script.'],
    score: [4, 3, 2, 1],
  },
  {
    key: 'comm', short: 'Texting',
    q: 'You\'re into someone. Your text frequency:',
    opts: ['All-day banter, no question.', 'Steady check-ins, real conversations.', 'A few times a day, more in person.', 'I save it for when we see each other.'],
    score: [4, 3, 2, 1],
  },
  {
    key: 'social', short: 'Social radius',
    q: 'Ideal Saturday night, honestly:',
    opts: ['Packed bar with the whole crew.', 'Dinner with 4–6 people I love.', '1-on-1 with someone interesting.', 'Couch. Movie. Phone face-down.'],
    score: [4, 3, 2, 1],
  },
  {
    key: 'risk', short: 'How you move',
    q: "Someone says 'let's just go.' No plan. You:",
    opts: ["I'm grabbing my keys.", "Ok — where roughly though?", "Need a destination first.", "Pass. I'll see you when you're back."],
    score: [4, 3, 2, 1],
  },
]

export function vibesFromAnswers(answers: number[]): Record<VibeKey, number> {
  const out: Partial<Record<VibeKey, number>> = {}
  VIBE_QUESTIONS.forEach((q, i) => {
    const idx = answers[i]
    if (idx === undefined || idx < 0 || idx >= q.opts.length) return
    out[q.key] = q.score[idx]
  })
  return out as Record<VibeKey, number>
}

// Human-readable label per (key, score 1..4) for display on results / profile.
export const VIBE_LABELS: Record<VibeKey, Record<number, string>> = {
  chronotype: {
    1: 'morning person',
    2: 'mid-day energy',
    3: 'afternoon peak',
    4: 'night owl',
  },
  date_freq: {
    1: 'whenever it happens',
    2: 'weekly-ish',
    3: '3–4x a week',
    4: 'most days',
  },
  future: {
    1: 'real for right now',
    2: 'serious, no script',
    3: 'long-term partner',
    4: 'marriage + kids',
  },
  comm: {
    1: 'mostly in person',
    2: 'a few daily texts',
    3: 'steady check-ins',
    4: 'all-day banter',
  },
  social: {
    1: 'homebody',
    2: '1-on-1 person',
    3: 'small dinners',
    4: 'big-crew nights',
  },
  risk: {
    1: 'needs the plan',
    2: 'destination first',
    3: 'rough plan works',
    4: 'spontaneous',
  },
}

export const VIBE_HEADS: Record<VibeKey, string> = {
  chronotype: 'rhythm',
  date_freq: 'how often',
  future: 'looking for',
  comm: 'texting',
  social: 'social',
  risk: 'how you move',
}

export function vibeLabel(key: VibeKey, score: number | undefined): string | null {
  if (score === undefined || score === null) return null
  return VIBE_LABELS[key]?.[score] ?? null
}

export const ARCHETYPES = [
  {
    name: 'The Curious Realist',
    tag: 'High Openness · Grounded Honesty',
    desc: "You see the world clearly and still find it interesting. Your match can keep up intellectually and won't sugarcoat anything.",
  },
  {
    name: 'The Principled Adventurer',
    tag: 'Strong Values · Genuine Curiosity',
    desc: 'Strong moral compass, real appetite for novelty. Your match challenges you without compromising who you are.',
  },
  {
    name: 'The Warm Skeptic',
    tag: 'High Emotionality · Selective Trust',
    desc: 'Emotionally intelligent, selectively trusting. You care deeply about the right people. Your match had to clear a bar. They did.',
  },
  {
    name: 'The Grounded Optimist',
    tag: 'Conscientious · Quietly Open',
    desc: "You make things work and don't make a big deal about it. Your match appreciates reliability and won't mistake it for boring.",
  },
  {
    name: 'The Deliberate Charmer',
    tag: 'High Extraversion · Real Depth',
    desc: 'The person everyone wants at the party and the person people actually call. Your match can hold their own.',
  },
  {
    name: 'The Honest Eccentric',
    tag: 'High Honesty · High Openness',
    desc: 'You say what you mean and mean something interesting. Your match has the emotional range to appreciate both.',
  },
]

export const LOADING_MSGS = [
  'Cross-referencing chaos levels...',
  'Consulting the Boston oracle...',
  'Penalizing red flag responses...',
  "Checking Dunkin' loyalty scores...",
  'Calibrating emotional damage...',
  'Your match is almost cooked...',
]

export const LOADING_STEPS = LOADING_MSGS

export const BOSTON_CENTER = { lat: 42.3601, lng: -71.0589 }
export const SIGNUP_RADIUS_MILES = 75
export const MATCH_RADIUS_MILES = 25

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

export const ZIP_COORDS: Record<string, { lat: number; lng: number }> = {
  '02101':{lat:42.3601,lng:-71.0589},
  '02102':{lat:42.3601,lng:-71.0589},
  '02103':{lat:42.3601,lng:-71.0589},
  '02104':{lat:42.3601,lng:-71.0589},
  '02105':{lat:42.3601,lng:-71.0589},
  '02106':{lat:42.3601,lng:-71.0589},
  '02107':{lat:42.3601,lng:-71.0589},
  '02108':{lat:42.3588,lng:-71.0631},
  '02109':{lat:42.3603,lng:-71.0511},
  '02110':{lat:42.3557,lng:-71.0521},
  '02111':{lat:42.3513,lng:-71.0589},
  '02112':{lat:42.3601,lng:-71.0589},
  '02113':{lat:42.3647,lng:-71.053},
  '02114':{lat:42.3616,lng:-71.068},
  '02115':{lat:42.3422,lng:-71.0985},
  '02116':{lat:42.3488,lng:-71.0807},
  '02117':{lat:42.3601,lng:-71.0589},
  '02118':{lat:42.3376,lng:-71.0726},
  '02119':{lat:42.3143,lng:-71.0868},
  '02120':{lat:42.3297,lng:-71.0991},
  '02121':{lat:42.3043,lng:-71.0812},
  '02122':{lat:42.2852,lng:-71.0513},
  '02123':{lat:42.3601,lng:-71.0589},
  '02124':{lat:42.2799,lng:-71.0706},
  '02125':{lat:42.3083,lng:-71.0578},
  '02126':{lat:42.2702,lng:-71.0896},
  '02127':{lat:42.3327,lng:-71.0413},
  '02128':{lat:42.3696,lng:-71.0097},
  '02129':{lat:42.3823,lng:-71.0604},
  '02130':{lat:42.3072,lng:-71.1133},
  '02131':{lat:42.2826,lng:-71.1198},
  '02132':{lat:42.2791,lng:-71.1543},
  '02133':{lat:42.3601,lng:-71.0589},
  '02134':{lat:42.3535,lng:-71.1321},
  '02135':{lat:42.3551,lng:-71.1546},
  '02136':{lat:42.2554,lng:-71.123},
  '02137':{lat:42.3601,lng:-71.0589},
  '02138':{lat:42.3765,lng:-71.1244},
  '02139':{lat:42.365,lng:-71.1031},
  '02140':{lat:42.3924,lng:-71.1296},
  '02141':{lat:42.3698,lng:-71.0782},
  '02142':{lat:42.3626,lng:-71.0827},
  '02143':{lat:42.3791,lng:-71.0997},
  '02144':{lat:42.3985,lng:-71.1219},
  '02145':{lat:42.3876,lng:-71.0793},
  '02148':{lat:42.4251,lng:-71.066},
  '02149':{lat:42.404,lng:-71.0545},
  '02150':{lat:42.386,lng:-71.0211},
  '02151':{lat:42.4087,lng:-71.0109},
  '02152':{lat:42.3485,lng:-70.9787},
  '02155':{lat:42.422,lng:-71.1068},
  '02163':{lat:42.366,lng:-71.1185},
  '02169':{lat:42.2513,lng:-71.0029},
  '02170':{lat:42.2671,lng:-71.0232},
  '02171':{lat:42.2792,lng:-71.0135},
  '02176':{lat:42.4603,lng:-71.0669},
  '02180':{lat:42.4762,lng:-71.1017},
  '02184':{lat:42.2187,lng:-71.0034},
  '02186':{lat:42.2496,lng:-71.119},
  '02188':{lat:42.2262,lng:-71.0427},
  '02189':{lat:42.2074,lng:-71.0201},
  '02190':{lat:42.1956,lng:-70.9913},
  '02191':{lat:42.2254,lng:-70.9609},
  '02196':{lat:42.3601,lng:-71.0589},
  '02199':{lat:42.3488,lng:-71.0807},
  '02201':{lat:42.3601,lng:-71.0589},
  '02203':{lat:42.3601,lng:-71.0589},
  '02204':{lat:42.3601,lng:-71.0589},
  '02205':{lat:42.3601,lng:-71.0589},
  '02206':{lat:42.3601,lng:-71.0589},
  '02207':{lat:42.3601,lng:-71.0589},
  '02208':{lat:42.3601,lng:-71.0589},
  '02209':{lat:42.3601,lng:-71.0589},
  '02210':{lat:42.3479,lng:-71.0448},
  '02211':{lat:42.3601,lng:-71.0589},
  '02212':{lat:42.3601,lng:-71.0589},
  '02215':{lat:42.3481,lng:-71.1025},
  '02217':{lat:42.3601,lng:-71.0589},
  '02222':{lat:42.3601,lng:-71.0589},
  '02228':{lat:42.3601,lng:-71.0589},
  '02241':{lat:42.3601,lng:-71.0589},
  '02266':{lat:42.3601,lng:-71.0589},
  '02283':{lat:42.3601,lng:-71.0589},
  '02284':{lat:42.3601,lng:-71.0589},
  '02293':{lat:42.3601,lng:-71.0589},
  '02297':{lat:42.3601,lng:-71.0589},
  '02298':{lat:42.3601,lng:-71.0589},
  '02445':{lat:42.331,lng:-71.121},
  '02446':{lat:42.346,lng:-71.121},
  '02447':{lat:42.331,lng:-71.121},
  '02451':{lat:42.3918,lng:-71.2418},
  '02452':{lat:42.3751,lng:-71.2418},
  '02453':{lat:42.3668,lng:-71.2501},
  '02454':{lat:42.3918,lng:-71.2501},
  '02455':{lat:42.3751,lng:-71.1918},
  '02456':{lat:42.3918,lng:-71.2168},
  '02457':{lat:42.3251,lng:-71.2751},
  '02458':{lat:42.3501,lng:-71.201},
  '02459':{lat:42.3251,lng:-71.226},
  '02460':{lat:42.3501,lng:-71.226},
  '02461':{lat:42.3251,lng:-71.201},
  '02462':{lat:42.3751,lng:-71.276},
  '02464':{lat:42.3251,lng:-71.251},
  '02465':{lat:42.3501,lng:-71.251},
  '02466':{lat:42.3501,lng:-71.276},
  '02467':{lat:42.3251,lng:-71.276},
  '02468':{lat:42.3501,lng:-71.301},
  '02472':{lat:42.3751,lng:-71.301},
  '02474':{lat:42.4251,lng:-71.151},
  '02475':{lat:42.4168,lng:-71.1751},
  '02476':{lat:42.4251,lng:-71.176},
  '02477':{lat:42.4168,lng:-71.2001},
  '02478':{lat:42.4001,lng:-71.176},
  '02479':{lat:42.3918,lng:-71.1918},
  '02481':{lat:42.3001,lng:-71.276},
  '02482':{lat:42.2751,lng:-71.251},
  '02492':{lat:42.2751,lng:-71.226},
  '02493':{lat:42.3501,lng:-71.351},
  '02494':{lat:42.2751,lng:-71.201},
  '02495':{lat:42.2918,lng:-71.2918},
  '01801':{lat:42.4793,lng:-71.1773},
  '01803':{lat:42.497,lng:-71.1398},
  '01810':{lat:42.6584,lng:-71.1437},
  '01821':{lat:42.5445,lng:-71.2759},
  '01824':{lat:42.5998,lng:-71.3668},
  '01826':{lat:42.6645,lng:-71.2982},
  '01827':{lat:42.6501,lng:-71.4518},
  '01840':{lat:42.7084,lng:-71.1625},
  '01841':{lat:42.7001,lng:-71.1625},
  '01842':{lat:42.7084,lng:-71.1625},
  '01843':{lat:42.7001,lng:-71.1365},
  '01844':{lat:42.7251,lng:-71.0793},
  '01845':{lat:42.6751,lng:-71.0793},
  '01850':{lat:42.6334,lng:-71.3162},
  '01851':{lat:42.6334,lng:-71.3162},
  '01852':{lat:42.6501,lng:-71.3101},
  '01853':{lat:42.6501,lng:-71.3101},
  '01854':{lat:42.6418,lng:-71.3654},
  '01860':{lat:42.8001,lng:-71.0168},
  '01862':{lat:42.696,lng:-71.3204},
  '01863':{lat:42.6743,lng:-71.3765},
  '01864':{lat:42.731,lng:-71.0767},
  '01867':{lat:42.5251,lng:-71.1001},
  '01876':{lat:42.5918,lng:-71.2295},
  '01879':{lat:42.6168,lng:-71.4295},
  '01880':{lat:42.5284,lng:-71.0645},
  '01886':{lat:42.5317,lng:-71.3796},
  '01887':{lat:42.5348,lng:-71.3285},
  '01890':{lat:42.4593,lng:-71.1518},
  '01901':{lat:42.4584,lng:-70.9418},
  '01902':{lat:42.4584,lng:-70.9501},
  '01903':{lat:42.4584,lng:-70.9501},
  '01904':{lat:42.4793,lng:-70.9793},
  '01905':{lat:42.4668,lng:-70.9501},
  '01906':{lat:42.4668,lng:-70.9668},
  '01907':{lat:42.4751,lng:-70.9001},
  '01908':{lat:42.4418,lng:-70.8793},
  '01910':{lat:42.4668,lng:-71.0001},
  '01913':{lat:42.8501,lng:-70.9668},
  '01915':{lat:42.5668,lng:-70.8668},
  '01921':{lat:42.7001,lng:-70.9001},
  '01922':{lat:42.7668,lng:-70.9335},
  '01923':{lat:42.5751,lng:-70.9418},
  '01929':{lat:42.6418,lng:-70.7668},
  '01930':{lat:42.6168,lng:-70.6668},
  '01938':{lat:42.7001,lng:-70.8168},
  '01940':{lat:42.5418,lng:-71.0418},
  '01944':{lat:42.5418,lng:-70.7668},
  '01945':{lat:42.5001,lng:-70.8668},
  '01949':{lat:42.5918,lng:-71.1418},
  '01950':{lat:42.8168,lng:-70.8501},
  '01951':{lat:42.7668,lng:-70.8668},
  '01952':{lat:42.8501,lng:-70.8668},
  '01960':{lat:42.5334,lng:-71.0001},
  '01961':{lat:42.5334,lng:-71.0001},
  '01966':{lat:42.6668,lng:-70.6168},
  '01969':{lat:42.7168,lng:-70.8168},
  '01970':{lat:42.5168,lng:-70.8835},
  '01971':{lat:42.5168,lng:-70.8835},
  '01982':{lat:42.6418,lng:-70.8668},
  '01983':{lat:42.6168,lng:-70.9501},
  '01984':{lat:42.6001,lng:-70.8501},
  '01985':{lat:42.7668,lng:-70.9668},
  '01701':{lat:42.2793,lng:-71.4162},
  '01702':{lat:42.2767,lng:-71.4165},
  '01703':{lat:42.2793,lng:-71.4162},
  '01704':{lat:42.2793,lng:-71.4162},
  '01705':{lat:42.2793,lng:-71.4162},
  '01718':{lat:42.4668,lng:-71.4168},
  '01719':{lat:42.4501,lng:-71.4918},
  '01720':{lat:42.486,lng:-71.4337},
  '01721':{lat:42.2454,lng:-71.4263},
  '01730':{lat:42.4918,lng:-71.2751},
  '01731':{lat:42.4501,lng:-71.2918},
  '01740':{lat:42.3751,lng:-71.5168},
  '01741':{lat:42.5168,lng:-71.3668},
  '01742':{lat:42.4604,lng:-71.5534},
  '01745':{lat:42.2668,lng:-71.5418},
  '01746':{lat:42.1668,lng:-71.5168},
  '01747':{lat:42.1168,lng:-71.5501},
  '01748':{lat:42.2168,lng:-71.5001},
  '01749':{lat:42.3918,lng:-71.5668},
  '01752':{lat:42.3418,lng:-71.5501},
  '01754':{lat:42.4251,lng:-71.4418},
  '01757':{lat:42.0918,lng:-71.5168},
  '01760':{lat:42.2948,lng:-71.3495},
  '01770':{lat:42.2418,lng:-71.3751},
  '01772':{lat:42.2918,lng:-71.5168},
  '01773':{lat:42.3918,lng:-71.3001},
  '01775':{lat:42.4501,lng:-71.5918},
  '01776':{lat:42.3668,lng:-71.4668},
  '01778':{lat:42.3668,lng:-71.3918},
  '01784':{lat:42.2918,lng:-71.5418},
  '02001':{lat:42.1501,lng:-70.976},
  '02021':{lat:42.1751,lng:-71.126},
  '02025':{lat:42.2501,lng:-70.801},
  '02026':{lat:42.2501,lng:-71.176},
  '02027':{lat:42.2501,lng:-71.151},
  '02030':{lat:42.2251,lng:-71.276},
  '02032':{lat:42.1751,lng:-71.201},
  '02035':{lat:42.0751,lng:-71.251},
  '02038':{lat:42.0751,lng:-71.401},
  '02043':{lat:42.2251,lng:-70.901},
  '02045':{lat:42.3001,lng:-70.876},
  '02047':{lat:42.1501,lng:-70.776},
  '02048':{lat:42.0251,lng:-71.226},
  '02050':{lat:42.094,lng:-70.7229},
  '02051':{lat:42.1001,lng:-70.726},
  '02052':{lat:42.2001,lng:-71.301},
  '02053':{lat:42.1251,lng:-71.451},
  '02054':{lat:42.1751,lng:-71.351},
  '02055':{lat:42.1001,lng:-70.801},
  '02056':{lat:42.1251,lng:-71.326},
  '02059':{lat:42.1001,lng:-70.701},
  '02060':{lat:42.1001,lng:-70.751},
  '02061':{lat:42.1501,lng:-70.851},
  '02062':{lat:42.1751,lng:-71.176},
  '02065':{lat:42.1251,lng:-70.701},
  '02066':{lat:42.2001,lng:-70.776},
  '02067':{lat:42.1001,lng:-71.201},
  '02071':{lat:42.1251,lng:-71.276},
  '02072':{lat:42.1251,lng:-71.101},
  '02081':{lat:42.0501,lng:-71.376},
  '02090':{lat:42.2251,lng:-71.201},
  '02093':{lat:42.1167,lng:-71.4167},
  '02301':{lat:42.0834,lng:-71.0184},
  '02302':{lat:42.0724,lng:-70.9943},
  '02303':{lat:42.0834,lng:-71.0184},
  '02304':{lat:42.0834,lng:-71.0184},
  '02305':{lat:42.0834,lng:-71.0184},
  '02322':{lat:42.1168,lng:-71.0501},
  '02324':{lat:41.9954,lng:-70.9776},
  '02325':{lat:41.9918,lng:-70.9501},
  '02327':{lat:42.0501,lng:-70.9168},
  '02330':{lat:41.8751,lng:-70.826},
  '02331':{lat:42.0501,lng:-70.851},
  '02332':{lat:42.0251,lng:-70.676},
  '02333':{lat:42.0751,lng:-70.951},
  '02334':{lat:42.0501,lng:-71.051},
  '02337':{lat:41.9751,lng:-70.851},
  '02338':{lat:41.9751,lng:-70.751},
  '02339':{lat:42.1001,lng:-70.901},
  '02340':{lat:42.0751,lng:-70.851},
  '02341':{lat:42.0001,lng:-70.876},
  '02343':{lat:42.1501,lng:-71.026},
  '02344':{lat:42.0001,lng:-70.826},
  '02345':{lat:41.9001,lng:-70.626},
  '02346':{lat:41.9407,lng:-70.8487},
  '02347':{lat:41.8751,lng:-70.926},
  '02348':{lat:41.8251,lng:-70.901},
  '02349':{lat:41.9001,lng:-70.851},
  '02351':{lat:42.1751,lng:-70.951},
  '02355':{lat:41.9501,lng:-70.651},
  '02356':{lat:42.0751,lng:-71.076},
  '02357':{lat:42.0501,lng:-71.101},
  '02358':{lat:42.0251,lng:-70.926},
  '02359':{lat:42.0751,lng:-70.776},
  '02360':{lat:41.9501,lng:-70.701},
  '02361':{lat:41.9251,lng:-70.751},
  '02362':{lat:41.9501,lng:-70.651},
  '02364':{lat:42.0001,lng:-70.726},
  '02366':{lat:41.8751,lng:-70.626},
  '02367':{lat:41.9751,lng:-70.876},
  '02368':{lat:42.1501,lng:-71.051},
  '02370':{lat:42.1251,lng:-70.951},
  '02375':{lat:42.0501,lng:-71.026},
  '02379':{lat:42.0501,lng:-71.076},
  '02382':{lat:42.0751,lng:-70.926},
  '01601':{lat:42.2626,lng:-71.8023},
  '01602':{lat:42.2709,lng:-71.8418},
  '01603':{lat:42.2418,lng:-71.8045},
  '01604':{lat:42.2501,lng:-71.7723},
  '01605':{lat:42.2876,lng:-71.7945},
  '01606':{lat:42.3126,lng:-71.7918},
  '01607':{lat:42.2293,lng:-71.7945},
  '01608':{lat:42.2626,lng:-71.8023},
  '01609':{lat:42.2793,lng:-71.8295},
  '01610':{lat:42.2418,lng:-71.7668},
  '01611':{lat:42.1918,lng:-71.7418},
  '01612':{lat:42.3168,lng:-71.8668},
  '01613':{lat:42.2626,lng:-71.8023},
  '01614':{lat:42.2626,lng:-71.8023},
  '01615':{lat:42.2626,lng:-71.8023},
  '01653':{lat:42.2626,lng:-71.8023},
  '02860':{lat:41.8751,lng:-71.3751},
  '02861':{lat:41.8918,lng:-71.3918},
  '02862':{lat:41.8751,lng:-71.3751},
  '02863':{lat:41.8918,lng:-71.4168},
  '02864':{lat:41.9418,lng:-71.4918},
  '02865':{lat:41.9168,lng:-71.4668},
  '02871':{lat:41.6668,lng:-71.2668},
  '02885':{lat:41.7418,lng:-71.3668},
  '02886':{lat:41.7168,lng:-71.4418},
  '02887':{lat:41.7168,lng:-71.4418},
  '02888':{lat:41.7668,lng:-71.4001},
  '02889':{lat:41.7001,lng:-71.3835},
  '02893':{lat:41.7001,lng:-71.5001},
  '02895':{lat:41.9751,lng:-71.4501},
  '02896':{lat:41.9668,lng:-71.4668},
  '02901':{lat:41.824,lng:-71.4128},
  '02902':{lat:41.824,lng:-71.4128},
  '02903':{lat:41.824,lng:-71.4128},
  '02904':{lat:41.8501,lng:-71.4295},
  '02905':{lat:41.7918,lng:-71.3918},
  '02906':{lat:41.8376,lng:-71.3795},
  '02907':{lat:41.8001,lng:-71.4295},
  '02908':{lat:41.8418,lng:-71.4418},
  '02909':{lat:41.8168,lng:-71.4418},
  '02910':{lat:41.7793,lng:-71.4045},
  '02911':{lat:41.8668,lng:-71.4545},
  '02912':{lat:41.8268,lng:-71.4028},
  '02914':{lat:41.8168,lng:-71.3668},
  '02915':{lat:41.7793,lng:-71.3545},
  '02916':{lat:41.8418,lng:-71.3545},
  '02917':{lat:41.8751,lng:-71.4795},
  '02918':{lat:41.8418,lng:-71.4295},
  '02919':{lat:41.8501,lng:-71.5045},
  '02920':{lat:41.7793,lng:-71.4545},
  '02921':{lat:41.7626,lng:-71.4795},
  '02840':{lat:41.4918,lng:-71.3128},
  '02841':{lat:41.5168,lng:-71.3501},
  '02842':{lat:41.5501,lng:-71.2918},
  '02852':{lat:41.5668,lng:-71.4501},
  '02835':{lat:41.5168,lng:-71.3918},
  '02837':{lat:41.5001,lng:-71.2251},
  '02838':{lat:41.9751,lng:-71.4751},
  '02839':{lat:41.9751,lng:-71.5501},
  '03031':{lat:42.8668,lng:-71.5918},
  '03032':{lat:42.9668,lng:-71.3168},
  '03033':{lat:42.8918,lng:-71.7501},
  '03034':{lat:43.0168,lng:-71.2918},
  '03036':{lat:42.9501,lng:-71.1668},
  '03037':{lat:43.0668,lng:-71.1501},
  '03038':{lat:42.9501,lng:-71.1168},
  '03044':{lat:42.9751,lng:-71.0918},
  '03045':{lat:42.9668,lng:-71.5501},
  '03048':{lat:42.7751,lng:-71.7501},
  '03049':{lat:42.7751,lng:-71.5168},
  '03051':{lat:42.8501,lng:-71.3918},
  '03052':{lat:42.8668,lng:-71.4168},
  '03053':{lat:42.8751,lng:-71.3168},
  '03054':{lat:42.8751,lng:-71.4668},
  '03055':{lat:42.8251,lng:-71.6168},
  '03060':{lat:42.7668,lng:-71.4501},
  '03062':{lat:42.7418,lng:-71.4001},
  '03063':{lat:42.7751,lng:-71.4418},
  '03064':{lat:42.7918,lng:-71.4668},
  '03076':{lat:42.7251,lng:-71.6168},
  '03079':{lat:42.7918,lng:-71.2168},
  '03087':{lat:42.7918,lng:-71.1668},
  '03801':{lat:43.0718,lng:-70.7626},
  '03802':{lat:43.0718,lng:-70.7626},
  '03803':{lat:43.0718,lng:-70.7626},
  '03804':{lat:43.0718,lng:-70.7626},
  '03805':{lat:43.0835,lng:-70.9168},
  '03809':{lat:43.3501,lng:-71.1918},
  '03811':{lat:42.8668,lng:-71.1501},
  '03819':{lat:42.8751,lng:-71.0668},
  '03820':{lat:43.1084,lng:-70.9251},
  '03821':{lat:43.1084,lng:-70.9251},
  '03822':{lat:43.1084,lng:-70.9251},
  '03823':{lat:43.1418,lng:-70.8751},
  '03824':{lat:43.1168,lng:-70.9168},
  '03825':{lat:43.1918,lng:-71.0168},
  '03826':{lat:42.9001,lng:-71.1168},
  '03827':{lat:42.9501,lng:-71.0418},
  '03830':{lat:43.3918,lng:-71.0168},
  '03833':{lat:42.9668,lng:-70.9501},
  '03835':{lat:43.2668,lng:-71.0501},
  '03837':{lat:43.3168,lng:-71.2668},
  '03839':{lat:43.2418,lng:-70.9751},
  '03840':{lat:43.0501,lng:-70.8418},
  '03841':{lat:42.9168,lng:-71.0168},
  '03842':{lat:42.9418,lng:-70.8168},
  '03843':{lat:42.9418,lng:-70.8168},
  '03844':{lat:42.8918,lng:-70.8668},
  '03848':{lat:42.9001,lng:-71.0251},
  '03854':{lat:43.0668,lng:-70.7751},
  '03856':{lat:43.0501,lng:-71.0751},
  '03857':{lat:43.0668,lng:-70.9918},
  '03858':{lat:42.8668,lng:-71.0001},
  '03859':{lat:43.2168,lng:-71.0668},
  '03861':{lat:43.1751,lng:-71.0168},
  '03862':{lat:42.9501,lng:-70.8168},
  '03865':{lat:42.8168,lng:-71.0418},
  '03866':{lat:43.3001,lng:-71.0001},
  '03867':{lat:43.2668,lng:-70.9751},
  '03868':{lat:43.2918,lng:-70.9418},
  '03869':{lat:43.2168,lng:-70.8668},
  '03870':{lat:43.0251,lng:-70.8001},
  '03871':{lat:43.0251,lng:-70.8168},
  '03873':{lat:42.9418,lng:-71.3418},
  '03874':{lat:42.8668,lng:-70.8168},
  '03876':{lat:43.1418,lng:-71.1418},
  '03878':{lat:43.2168,lng:-70.9168},
  '03884':{lat:43.2668,lng:-71.1418},
  '03885':{lat:43.0168,lng:-70.9668},
  '03301':{lat:43.2081,lng:-71.5376},
  '03302':{lat:43.2081,lng:-71.5376},
  '03303':{lat:43.2081,lng:-71.5376},
  '03304':{lat:43.1501,lng:-71.5751},
  '03305':{lat:43.2081,lng:-71.5376},
  '02532':{lat:41.7501,lng:-70.5501},
  '02534':{lat:41.6751,lng:-70.6001},
  '02536':{lat:41.5918,lng:-70.5751},
  '02537':{lat:41.7251,lng:-70.4251},
  '02538':{lat:41.8001,lng:-70.6501},
  '02540':{lat:41.5584,lng:-70.6084},
  '02541':{lat:41.6501,lng:-70.5251},
  '02542':{lat:41.6918,lng:-70.5084},
  '02543':{lat:41.5251,lng:-70.6418},
  '02544':{lat:41.5251,lng:-70.6168},
  '02556':{lat:41.6751,lng:-70.4751},
  '02557':{lat:41.4584,lng:-70.5668},
  '02559':{lat:41.6918,lng:-70.4918},
  '02561':{lat:41.7501,lng:-70.4918},
  '02562':{lat:41.7834,lng:-70.5168},
  '02563':{lat:41.7168,lng:-70.5251},
  '02571':{lat:41.7501,lng:-70.7168},
  '02574':{lat:41.6001,lng:-70.4751},
  '02575':{lat:41.4501,lng:-70.7001},
  '02576':{lat:41.7751,lng:-70.7918},
  '02601':{lat:41.6501,lng:-70.2751},
  '02630':{lat:41.6918,lng:-70.3001},
  '02631':{lat:41.7501,lng:-70.0084},
  '02632':{lat:41.6501,lng:-70.3501},
  '02633':{lat:41.6918,lng:-69.9584},
  '02634':{lat:41.6751,lng:-70.3501},
  '02635':{lat:41.6251,lng:-70.4418},
  '02636':{lat:41.6501,lng:-70.3001},
  '02637':{lat:41.6751,lng:-70.2751},
  '02638':{lat:41.7418,lng:-70.2168},
  '02639':{lat:41.6584,lng:-70.1668},
  '02641':{lat:41.7251,lng:-70.1501},
  '02642':{lat:41.8084,lng:-69.9918},
  '02643':{lat:41.7918,lng:-69.9501},
  '02644':{lat:41.6168,lng:-70.4168},
  '02645':{lat:41.6751,lng:-70.0751},
  '02646':{lat:41.6668,lng:-70.0418},
  '02647':{lat:41.6418,lng:-70.1168},
  '02648':{lat:41.6584,lng:-70.4751},
  '02649':{lat:41.5584,lng:-70.4168},
  '02650':{lat:41.7751,lng:-69.9668},
  '02651':{lat:41.7918,lng:-70.0001},
  '02652':{lat:41.9168,lng:-70.0418},
  '02653':{lat:41.7751,lng:-69.9501},
  '02655':{lat:41.6334,lng:-70.3834},
  '02657':{lat:42.0501,lng:-70.1834},
  '02659':{lat:41.7168,lng:-70.0418},
  '02660':{lat:41.6918,lng:-70.0168},
  '02661':{lat:41.6668,lng:-70.0168},
  '02662':{lat:41.8168,lng:-69.9918},
  '02663':{lat:41.9001,lng:-69.9584},
  '02664':{lat:41.7168,lng:-70.1751},
  '02666':{lat:41.9668,lng:-70.0418},
  '02667':{lat:41.8668,lng:-69.9751},
  '02668':{lat:41.7751,lng:-70.3418},
  '02669':{lat:41.6418,lng:-70.1668},
  '02670':{lat:41.6668,lng:-70.1584},
  '02671':{lat:41.6668,lng:-70.1584},
  '02672':{lat:41.6334,lng:-70.2084},
  '02673':{lat:41.6584,lng:-70.2418},
  '02675':{lat:41.7001,lng:-70.2918},
}

export function validateZip(zip: string): 'valid'|'invalid'|'outofrange'|'incomplete' {
  if (zip.length < 5) return 'incomplete'
  const coords = ZIP_COORDS[zip]
  if (!coords) return 'invalid'
  const dist = haversine(BOSTON_CENTER.lat, BOSTON_CENTER.lng, coords.lat, coords.lng)
  return dist <= SIGNUP_RADIUS_MILES ? 'valid' : 'outofrange'
}

// ─── Metros (area pools) ───────────────────────────────────────────────
// The 75mi signup radius already pulls in Worcester (~40mi) and Providence
// (~50mi), and the 25mi MATCH radius already isolates them into separate
// clusters (they can't cross-match Boston). This labels which cluster a
// user sits in — for admin analytics now, and regional pool-balancing
// later. It changes NO matching behavior on its own (dormant).
export const METRO_CENTERS: Record<string, { label: string; lat: number; lng: number }> = {
  boston:     { label: 'Boston',     lat: 42.3601, lng: -71.0589 },
  worcester:  { label: 'Worcester',  lat: 42.2626, lng: -71.8023 },
  providence: { label: 'Providence', lat: 41.8240, lng: -71.4128 },
}

export type Metro = keyof typeof METRO_CENTERS

// Nearest metro to a zip, or null if the zip is unknown / beyond range of
// every metro center.
export function metroOf(zip: string | null | undefined): Metro | null {
  if (!zip) return null
  const c = ZIP_COORDS[zip]
  if (!c) return null
  let best: Metro | null = null
  let bestDist = Infinity
  for (const [key, m] of Object.entries(METRO_CENTERS)) {
    const d = haversine(c.lat, c.lng, m.lat, m.lng)
    if (d < bestDist) { bestDist = d; best = key as Metro }
  }
  return bestDist <= SIGNUP_RADIUS_MILES ? best : null
}

export function computeScores(answers: number[]): Record<Dimension, number> {
  const scores: Record<string, number> = {}
  DIMS.forEach(d => (scores[d] = 0))
  answers.forEach((ans, i) => {
    if (ans === -1) { scores[QUESTIONS[i].dim] += 2; return }
    scores[QUESTIONS[i].dim] += QUESTIONS[i].score[ans]
  })
  return scores as Record<Dimension, number>
}

export function pickArchetype(scores: Record<Dimension, number>) {
  const topDim = DIMS.reduce((a, b) => scores[a] > scores[b] ? a : b)
  const map: Record<Dimension, number> = {
    'Honesty-Humility': 0,
    'Emotionality': 2,
    'Extraversion': 4,
    'Agreeableness': 3,
    'Conscientiousness': 3,
    'Openness': 0,
  }
  return ARCHETYPES[map[topDim]] ?? ARCHETYPES[0]
}
