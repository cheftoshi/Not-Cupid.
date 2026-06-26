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

// Trimmed to 12 (2 per trait) for a shorter, lower-drop-off quiz — still valid
// for matching. Each dimension's max raw score is now 8 (2 questions × 4 pts).
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
    dim: 'Extraversion', short: 'Extraversion',
    q: '"We need to talk" lands in your DMs. Before you know what it\'s about, you:',
    opts: ['"When?" and move on.', 'Run the scenarios quickly.', 'Full spiral. Three drafts.', 'Go quiet and wait.'],
    score: [4, 3, 2, 1],
  },
  {
    dim: 'Extraversion', short: 'Extraversion',
    q: 'Group chat: "what are we doing tonight?" You:',
    opts: ['Three ideas with links.', 'One thing, commit hard.', '"Down for whatever."', '👍 and await instructions.'],
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
    dim: 'Openness', short: 'Openness',
    q: '"Slow but rewarding" movie recommendation. You:',
    opts: ['Watch immediately. My genre.', 'List. Eventually.', 'How slow are we talking.', "Put on something I've seen before."],
    score: [4, 3, 2, 1],
  },
  {
    dim: 'Openness', short: 'Openness',
    q: "Your relationship with your own weirdness:",
    opts: ["Fully embraced. It's the point.", 'Aware of it. Selectively deploy.', 'I prefer "specific" to "weird."', "I'm not weird. I'm particular."],
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
  { value: 'open',            short: 'open to anything', label: 'Open to anything',
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

// ═══════════════════════════════════════════════════════════════════════════
// QUIZ v2 — attachment style + values (the dimensions the research says
// actually predict compatibility, vs. trait similarity which doesn't).
// ═══════════════════════════════════════════════════════════════════════════

// ─── Attachment (adapted from ECR-S short-form). 8 statements rated on a 1–5
//     agree scale; 4 load on ANXIETY, 4 on AVOIDANCE (some reverse-keyed).
//     → two 0–100 scores + a style (secure / anxious / avoidant / fearful).
//     Attachment is the single most predictive individual-difference dimension
//     for relationship quality (Joel 2020; Candel & Turliuc 2019 meta).
export interface AttachmentItem { sub: 'anx' | 'avo'; reverse?: boolean; q: string }

export const ATTACHMENT_QUESTIONS: AttachmentItem[] = [
  { sub: 'anx', q: 'I worry that the people I date don’t really care about me as much as I care about them.' },
  { sub: 'anx', q: 'I need a fair amount of reassurance that someone I’m seeing actually likes me.' },
  { sub: 'anx', q: 'When someone I’m into goes quiet, I assume something’s wrong.' },
  { sub: 'anx', reverse: true, q: 'I rarely worry about someone losing interest in me.' },
  { sub: 'avo', q: 'I’d rather not show someone how I really feel deep down.' },
  { sub: 'avo', q: 'I find it hard to fully rely on a partner.' },
  { sub: 'avo', reverse: true, q: 'I’m comfortable opening up and getting close fast.' },
  { sub: 'avo', reverse: true, q: 'Depending on someone — and being depended on — feels natural to me.' },
]

// answers: array aligned to ATTACHMENT_QUESTIONS, each 1..5 (-1 = skipped → neutral 3).
export function computeAttachment(answers: number[]): { anxiety: number; avoidance: number; style: AttachStyle } {
  let anxRaw = 0, anxN = 0, avoRaw = 0, avoN = 0
  ATTACHMENT_QUESTIONS.forEach((item, i) => {
    let a = answers[i]
    if (a === undefined || a === -1) a = 3
    a = Math.max(1, Math.min(5, a))
    const v = item.reverse ? 6 - a : a
    if (item.sub === 'anx') { anxRaw += v; anxN++ } else { avoRaw += v; avoN++ }
  })
  // mean (1..5) → 0..100
  const anxiety = anxN ? Math.round(((anxRaw / anxN) - 1) / 4 * 100) : 50
  const avoidance = avoN ? Math.round(((avoRaw / avoN) - 1) / 4 * 100) : 50
  return { anxiety, avoidance, style: attachStyle(anxiety, avoidance) }
}

export type AttachStyle = 'secure' | 'anxious' | 'avoidant' | 'fearful'
export function attachStyle(anxiety: number, avoidance: number): AttachStyle {
  const hiAnx = anxiety >= 50, hiAvo = avoidance >= 50
  if (hiAnx && hiAvo) return 'fearful'
  if (hiAnx) return 'anxious'
  if (hiAvo) return 'avoidant'
  return 'secure'
}
export const ATTACH_LABEL: Record<AttachStyle, string> = {
  secure: 'secure', anxious: 'anxious-leaning', avoidant: 'avoidant-leaning', fearful: 'fearful (anxious + avoidant)',
}
export const ATTACH_BLURB: Record<AttachStyle, string> = {
  secure: 'comfortable with closeness and independence — you give and take support easily.',
  anxious: 'you love deeply and want closeness; reassurance and consistency matter to you.',
  avoidant: 'you value your independence and take your time letting people in.',
  fearful: 'you crave closeness and guard it at the same time — depth on your own terms.',
}

// ─── Values (single-choice, like the vibes). Captures the things that actually
//     gate compatibility: kids, faith, politics, ambition, lifestyle pace,
//     substances. Stored as users.values_profile JSONB.
export type ValueKey = 'kids' | 'faith' | 'politics' | 'ambition' | 'lifestyle' | 'fitness' | 'substances'
export interface ValuesQuestion { key: ValueKey; short: string; q: string; opts: string[]; vals: (string | number)[] }

export const VALUES_QUESTIONS: ValuesQuestion[] = [
  { key: 'kids', short: 'Kids', q: 'Kids — where do you honestly land?',
    opts: ['Want them', 'Open / maybe someday', 'Don’t want them', 'Already have + content'],
    vals: ['yes', 'maybe', 'no', 'have'] },
  { key: 'faith', short: 'Faith', q: 'How big a role does faith or spirituality play in your life?',
    opts: ['Central to who I am', 'Somewhat important', 'Not really', 'None at all'],
    vals: [3, 2, 1, 0] },
  { key: 'politics', short: 'Politics', q: 'How much do you need a partner to share your politics?',
    opts: ['It’s a dealbreaker', 'Prefer we align', 'Can handle some difference', 'I’m pretty apolitical'],
    vals: [3, 2, 1, 0] },
  { key: 'ambition', short: 'Ambition', q: 'Your relationship with work and ambition?',
    opts: ['Career is a top priority', 'Driven but balanced', 'Work to live', 'Anti-hustle, fully'],
    vals: [3, 2, 1, 0] },
  { key: 'lifestyle', short: 'Pace', q: 'Your default speed in life?',
    opts: ['Always out, always moving', 'Social but I need to recharge', 'Mostly cozy', 'Full homebody'],
    vals: [3, 2, 1, 0] },
  { key: 'fitness', short: 'Health', q: 'How central is health & fitness to your life?',
    opts: ['It’s a lifestyle — most days', 'Regular, a few times a week', 'On and off', 'Not really my thing'],
    vals: [3, 2, 1, 0] },
  { key: 'substances', short: 'Drinking', q: 'Drinking / substances?',
    opts: ['Sober', 'Rarely', 'Socially', 'Regularly'],
    vals: ['none', 'rare', 'social', 'regular'] },
]

export function valuesFromAnswers(answers: number[]): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  VALUES_QUESTIONS.forEach((q, i) => {
    const idx = answers[i]
    if (idx === undefined || idx < 0 || idx >= q.opts.length) return
    out[q.key] = q.vals[idx]
  })
  return out
}

export const KIDS_LABEL: Record<string, string> = { yes: 'wants kids', maybe: 'open to kids', no: 'no kids', have: 'has kids' }

// ─── Partner preferences (LOVE-line deep quiz — "what you're looking for").
//     The first question maps to users.relationship_style (drives the matcher's
//     intent prioritization + ENM/poly hard-cluster). The rest land in
//     values_profile.partner for preference-matching levers down the line.
export interface PartnerQuestion { key: string; short: string; q: string; opts: string[]; vals: (string | number)[]; mapsTo?: 'relationship_style'; multi?: boolean; hint?: string }

// `multi: true` questions let you pick more than one — people vibe with more
// than one thing. They store an ARRAY of vals on values_profile.partner[key].
export const PARTNER_QUESTIONS: PartnerQuestion[] = [
  { key: 'intent', short: 'Looking for', q: 'What are you actually looking for right now?',
    opts: ['Marriage + kids in mind', 'Long-term, no kids (DINK)', 'Something real, no rush', 'Casual / right-now', 'ENM / polyamorous'],
    vals: ['marriage_track', 'dink', 'open', 'casual', 'enm_poly'], mapsTo: 'relationship_style' },
  { key: 'pace', short: 'Pace', q: 'Your ideal pace for something new?',
    opts: ['Slow burn — let it build', 'Steady and intentional', 'All in when it’s right'],
    vals: ['slow', 'steady', 'fast'] },
  { key: 'energy', short: 'Their energy', q: 'You click most with someone who’s…',
    opts: ['A homebody like me', 'Balanced — in and out', 'Always out and social'],
    vals: ['home', 'balanced', 'social'] },
  { key: 'draws', short: 'Draws you in', q: 'What actually draws you to someone?',
    hint: 'pick as many as feel true', multi: true,
    opts: ['A sharp sense of humor', 'Ambition + drive', 'Warmth + kindness', 'Real emotional depth', 'A spirit for adventure', 'Creativity', 'Intelligence', 'A calm, grounded presence', 'Good looks, honestly'],
    vals: ['humor', 'ambition', 'warmth', 'depth', 'adventure', 'creativity', 'intelligence', 'calm', 'looks'] },
  { key: 'priority', short: 'Matters most', q: 'What matters most to you in a match?',
    hint: 'pick all that count — not just one', multi: true,
    opts: ['Shared values', 'Emotional depth', 'Physical chemistry', 'Shared lifestyle', 'Big shared ambitions', 'Just makes me laugh'],
    vals: ['values', 'emotional', 'chemistry', 'lifestyle', 'ambition', 'humor'] },
]

// Returns the relationship_style (from the intent question) + a partner-prefs
// object for values_profile.partner. Single questions store one val; `multi`
// questions store an array. Skips (answer -1 / []) are omitted.
export function partnerFromAnswers(answers: (number | number[])[]): { relationship_style?: string; partner: Record<string, string | number | string[]> } {
  const partner: Record<string, string | number | string[]> = {}
  let relationship_style: string | undefined
  PARTNER_QUESTIONS.forEach((qq, i) => {
    const a = answers[i]
    if (qq.multi) {
      const idxs = Array.isArray(a) ? a : typeof a === 'number' && a >= 0 ? [a] : []
      const vals = idxs.filter((idx) => idx >= 0 && idx < qq.opts.length).map((idx) => String(qq.vals[idx]))
      if (vals.length) partner[qq.key] = vals
      return
    }
    const idx = Array.isArray(a) ? a[0] : a
    if (idx === undefined || idx < 0 || idx >= qq.opts.length) return
    const v = qq.vals[idx]
    if (qq.mapsTo === 'relationship_style') relationship_style = String(v)
    else partner[qq.key] = v
  })
  return { relationship_style, partner }
}

// ─── Rapid fire ⚡ — fast this-or-that. A palate cleanser that's mostly for fun
//     but also drops a few light vibe tags into matching (small weight).
//     Option A = 0, Option B = 1. Stored in users.vibes.rapid.
export interface RapidQ { key: string; q: string; a: string; b: string }
export const RAPID_FIRE: RapidQ[] = [
  { key: 'texter', q: 'Texting, honestly:', a: 'Instant replier', b: 'Leaves you on read' },
  { key: 'night', q: 'Friday night:', a: 'Out out', b: 'Cozy in' },
  { key: 'terrain', q: 'Dream escape:', a: 'Mountains', b: 'Beach' },
  { key: 'fuel', q: 'Morning fuel:', a: 'Coffee', b: 'Tea / matcha' },
  { key: 'clock', q: 'You run on:', a: 'Early bird', b: 'Night owl' },
  { key: 'spont', q: 'A trip is:', a: 'Planned to the hour', b: 'Total wing-it' },
  { key: 'pets', q: 'Team:', a: 'Dogs', b: 'Cats' },
  { key: 'pineapple', q: 'Pineapple on pizza:', a: 'Yes chef', b: 'Crime' },
]
// answers aligned to RAPID_FIRE: 0 or 1 (skip = omit). Stored under vibes.rapid.
export function rapidFromAnswers(answers: number[]): Record<string, number> {
  const out: Record<string, number> = {}
  RAPID_FIRE.forEach((q, i) => { if (answers[i] === 0 || answers[i] === 1) out[q.key] = answers[i] })
  return out
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
// Default match radius. Users start tight (15mi) and can widen in 15mi steps
// up to the signup cap (75mi) when their pool is thin.
export const MATCH_RADIUS_MILES = 15
export const DEFAULT_MATCH_RADIUS = 15
export const MAX_MATCH_RADIUS = 75
export const RADIUS_STEP = 15

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

// Distance in miles between two ZIPs, or null if either is unknown.
export function zipDistanceMiles(zip1: string | null | undefined, zip2: string | null | undefined): number | null {
  if (!zip1 || !zip2) return null
  const c1 = coordsForZip(zip1)
  const c2 = coordsForZip(zip2)
  if (!c1 || !c2) return null
  return haversine(c1.lat, c1.lng, c2.lat, c2.lng)
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

// New England coverage by 3-digit ZIP prefix (010–069 = MA/RI/NH/ME/VT/CT).
// Used as a fallback in coordsForZip for regions we don't hardcode at the full-
// zip level — so anyone in New England resolves to a sane location for distance
// + metro labeling. (Eastern-MA/RI prefixes already have full-zip coverage in
// ZIP_COORDS above and never hit this table.)
export const PREFIX_COORDS: Record<string, { lat: number; lng: number }> = {
  // Massachusetts (west + central + north + south where not already covered)
  '010':{lat:42.11,lng:-72.55}, '011':{lat:42.15,lng:-72.70}, '012':{lat:42.40,lng:-73.18},
  '013':{lat:42.40,lng:-72.55}, '014':{lat:42.58,lng:-71.80}, '015':{lat:42.40,lng:-71.75},
  '016':{lat:42.26,lng:-71.80}, '017':{lat:42.30,lng:-71.42}, '018':{lat:42.55,lng:-71.20},
  '019':{lat:42.50,lng:-70.95},
  // South Coast MA (New Bedford / Fall River) — ZIP_COORDS gap backstop
  '027':{lat:41.64,lng:-70.93},
  // Rhode Island
  '028':{lat:41.82,lng:-71.41}, '029':{lat:41.70,lng:-71.45},
  // New Hampshire
  '030':{lat:42.76,lng:-71.46}, '031':{lat:42.99,lng:-71.46}, '032':{lat:43.05,lng:-71.45},
  '033':{lat:43.21,lng:-71.54}, '034':{lat:43.05,lng:-70.78}, '035':{lat:44.31,lng:-71.77},
  '036':{lat:42.93,lng:-72.28}, '037':{lat:43.64,lng:-72.25}, '038':{lat:43.20,lng:-70.87},
  // Maine
  '039':{lat:43.08,lng:-70.74}, '040':{lat:43.66,lng:-70.26}, '041':{lat:43.85,lng:-69.96},
  '042':{lat:44.08,lng:-70.20}, '043':{lat:44.40,lng:-69.78}, '044':{lat:44.80,lng:-68.77},
  '045':{lat:44.90,lng:-68.50}, '046':{lat:46.13,lng:-67.84}, '047':{lat:46.68,lng:-68.01},
  '048':{lat:45.20,lng:-69.20}, '049':{lat:44.10,lng:-69.11},
  // Vermont
  '050':{lat:43.65,lng:-72.32}, '051':{lat:42.85,lng:-72.56}, '052':{lat:43.13,lng:-72.44},
  '053':{lat:42.95,lng:-72.60}, '054':{lat:44.48,lng:-73.21}, '056':{lat:44.26,lng:-72.58},
  '057':{lat:43.61,lng:-72.97}, '058':{lat:44.94,lng:-72.21}, '059':{lat:44.42,lng:-72.02},
  // Connecticut
  '060':{lat:41.70,lng:-72.75}, '061':{lat:41.76,lng:-72.69}, '062':{lat:41.78,lng:-72.52},
  '063':{lat:41.52,lng:-72.10}, '064':{lat:41.40,lng:-72.85}, '065':{lat:41.31,lng:-72.93},
  '066':{lat:41.18,lng:-73.19}, '067':{lat:41.56,lng:-73.04}, '068':{lat:41.10,lng:-73.45},
  '069':{lat:41.05,lng:-73.60},
  // North Jersey (070–079) — NYC commuter belt: Newark, Jersey City, Hoboken,
  // Bergen/Hudson/Essex/Union, Paterson, Morristown. Folds into the NYC pool.
  '070':{lat:40.72,lng:-74.05}, '071':{lat:40.73,lng:-74.17}, '072':{lat:40.66,lng:-74.21},
  '073':{lat:40.71,lng:-74.06}, '074':{lat:40.92,lng:-74.17}, '075':{lat:40.89,lng:-74.04},
  '076':{lat:40.92,lng:-74.07}, '077':{lat:40.35,lng:-74.07}, '078':{lat:40.80,lng:-74.48},
  '079':{lat:40.70,lng:-74.36},
  // New York City metro (100–119). Manhattan/Bronx/SI, Westchester+Rockland,
  // Queens/Brooklyn, then Far Rockaway + Nassau/Suffolk Long Island.
  '100':{lat:40.78,lng:-73.97}, '101':{lat:40.78,lng:-73.97}, '102':{lat:40.78,lng:-73.97},
  '103':{lat:40.58,lng:-74.15}, '104':{lat:40.85,lng:-73.88},
  '105':{lat:41.03,lng:-73.76}, '106':{lat:41.03,lng:-73.76}, '107':{lat:40.93,lng:-73.90},
  '108':{lat:40.91,lng:-73.78}, '109':{lat:41.09,lng:-73.92},
  '110':{lat:40.75,lng:-73.94}, '111':{lat:40.76,lng:-73.92}, '112':{lat:40.65,lng:-73.95},
  '113':{lat:40.75,lng:-73.82}, '114':{lat:40.70,lng:-73.81},
  '115':{lat:40.73,lng:-73.60}, '116':{lat:40.60,lng:-73.75}, '117':{lat:40.78,lng:-73.30},
  '118':{lat:40.76,lng:-73.52}, '119':{lat:40.87,lng:-72.85},
}

// Resolve a zip to coordinates. Falls back to the centroid of all known zips
// sharing the same 3-digit prefix (ZCTA region) when the exact zip isn't in
// our table — so a real resident of a covered area (e.g. a Providence 029xx or
// Cape 026xx zip we didn't hardcode) is NOT wrongly rejected at signup. Only a
// zip whose entire prefix is unknown returns null.
const _prefixCentroids: Record<string, { lat: number; lng: number } | null> = {}
export function coordsForZip(zip: string | null | undefined): { lat: number; lng: number } | null {
  if (!zip || zip.length < 5) return null
  const exact = ZIP_COORDS[zip]
  if (exact) return exact
  const prefix = zip.slice(0, 3)
  if (prefix in _prefixCentroids) return _prefixCentroids[prefix]
  let sumLat = 0, sumLng = 0, n = 0
  for (const z in ZIP_COORDS) {
    if (z.slice(0, 3) === prefix) { sumLat += ZIP_COORDS[z].lat; sumLng += ZIP_COORDS[z].lng; n++ }
  }
  const centroid = n > 0 ? { lat: sumLat / n, lng: sumLng / n } : (PREFIX_COORDS[prefix] ?? null)
  _prefixCentroids[prefix] = centroid
  return centroid
}

// New England = ZIP prefixes 010–069 (MA 010–027, RI 028–029, NH 030–038,
// ME 039–049, VT 050–059, CT 060–069). NJ starts at 070.
export function isNewEnglandZip(zip: string | null | undefined): boolean {
  if (!zip || !/^\d{5}$/.test(zip)) return false
  const p = parseInt(zip.slice(0, 3), 10)
  return p >= 10 && p <= 69
}

// NYC metro = ZIP prefixes 100–119 (Manhattan/Bronx/SI 100–104, Westchester &
// Rockland 105–109, Queens/Brooklyn 110–114, Far Rockaway/Nassau/Suffolk LI
// 115–119). Upstate NY (120–149) is intentionally NOT included yet.
export function isNycMetroZip(zip: string | null | undefined): boolean {
  if (!zip || !/^\d{5}$/.test(zip)) return false
  const p = parseInt(zip.slice(0, 3), 10)
  return p >= 100 && p <= 119
}

// North Jersey = the NYC commuter belt (Newark, Jersey City, Hoboken, Bergen /
// Hudson / Essex / Union — prefixes 070–079). It sits 2–5mi from Manhattan, so
// distance-based matching folds it straight into the NYC pool (it densifies NYC
// rather than starting a new market). South/Central NJ (080–099 = the Philly
// metro) stays OUT.
export function isNorthJerseyZip(zip: string | null | undefined): boolean {
  if (!zip || !/^\d{5}$/.test(zip)) return false
  const p = parseInt(zip.slice(0, 3), 10)
  return p >= 70 && p <= 79
}

// Signup eligibility: all of New England + the NYC metro (incl. North Jersey).
// Matching stays LOCAL per-user (match_radius) + is purely distance-based, so
// North Jersey naturally joins the NYC pool without touching other metros.
export function isEligibleZip(zip: string | null | undefined): boolean {
  return isNewEnglandZip(zip) || isNycMetroZip(zip) || isNorthJerseyZip(zip)
}

export function validateZip(zip: string): 'valid'|'invalid'|'outofrange'|'incomplete' {
  if (zip.length < 5) return 'incomplete'
  if (!/^\d{5}$/.test(zip)) return 'invalid'
  // Eligibility = New England + NYC metro (matching stays local via match_radius).
  return isEligibleZip(zip) ? 'valid' : 'outofrange'
}

// ─── Metros (area pools) ───────────────────────────────────────────────
// The 75mi signup radius already pulls in Worcester (~40mi) and Providence
// (~50mi), and the 25mi MATCH radius already isolates them into separate
// clusters (they can't cross-match Boston). This labels which cluster a
// user sits in — for admin analytics now, and regional pool-balancing
// later. It changes NO matching behavior on its own (dormant).
export const METRO_CENTERS: Record<string, { label: string; city: string; state: string; lat: number; lng: number }> = {
  // Massachusetts
  boston:      { label: 'Boston',         city: 'Boston',        state: 'MA', lat: 42.3601, lng: -71.0589 },
  worcester:   { label: 'Worcester',      city: 'Worcester',     state: 'MA', lat: 42.2626, lng: -71.8023 },
  springfield: { label: 'Springfield',    city: 'Springfield',   state: 'MA', lat: 42.1015, lng: -72.5898 },
  berkshires:  { label: 'Berkshires',     city: 'Pittsfield',    state: 'MA', lat: 42.4501, lng: -73.2454 },
  capecod:     { label: 'Cape Cod',       city: 'Hyannis',       state: 'MA', lat: 41.6529, lng: -70.2890 },
  southcoast:  { label: 'South Coast',    city: 'New Bedford',   state: 'MA', lat: 41.6362, lng: -70.9342 },
  merrimack:   { label: 'Merrimack Valley', city: 'Lowell',      state: 'MA', lat: 42.6334, lng: -71.3162 },
  // Rhode Island
  providence:  { label: 'Providence',     city: 'Providence',    state: 'RI', lat: 41.8240, lng: -71.4128 },
  // New Hampshire
  manchester:  { label: 'Manchester',     city: 'Manchester',    state: 'NH', lat: 42.9956, lng: -71.4548 },
  concord_nh:  { label: 'Concord',        city: 'Concord',       state: 'NH', lat: 43.2081, lng: -71.5376 },
  seacoast:    { label: 'Seacoast',       city: 'Portsmouth',    state: 'NH', lat: 43.0718, lng: -70.7626 },
  // Maine
  portland_me: { label: 'Portland',       city: 'Portland',      state: 'ME', lat: 43.6591, lng: -70.2568 },
  augusta:     { label: 'Augusta',        city: 'Augusta',       state: 'ME', lat: 44.3106, lng: -69.7795 },
  bangor:      { label: 'Bangor',         city: 'Bangor',        state: 'ME', lat: 44.8012, lng: -68.7778 },
  // Vermont
  burlington:  { label: 'Burlington',     city: 'Burlington',    state: 'VT', lat: 44.4759, lng: -73.2121 },
  montpelier:  { label: 'Montpelier',     city: 'Montpelier',    state: 'VT', lat: 44.2601, lng: -72.5754 },
  // Connecticut
  hartford:    { label: 'Hartford',       city: 'Hartford',      state: 'CT', lat: 41.7658, lng: -72.6734 },
  newhaven:    { label: 'New Haven',      city: 'New Haven',     state: 'CT', lat: 41.3083, lng: -72.9279 },
  fairfield:   { label: 'Fairfield County', city: 'Stamford',    state: 'CT', lat: 41.0534, lng: -73.5387 },
  easternct:   { label: 'Eastern CT',     city: 'New London',    state: 'CT', lat: 41.3557, lng: -72.0995 },
  // New York (NYC metro only for now — its own dense, separate pool)
  nyc:         { label: 'New York City',  city: 'New York',      state: 'NY', lat: 40.7128, lng: -74.0060 },
  longisland:  { label: 'Long Island',    city: 'Hempstead',     state: 'NY', lat: 40.7062, lng: -73.6187 },
  westchester: { label: 'Westchester',    city: 'White Plains',  state: 'NY', lat: 41.0340, lng: -73.7629 },
  // New Jersey (North Jersey only — the NYC commuter belt; shares NYC's pool)
  northjersey: { label: 'North Jersey',   city: 'Jersey City',   state: 'NJ', lat: 40.7220, lng: -74.0760 },
}

export type Metro = keyof typeof METRO_CENTERS

// A central, real ZIP for each metro — lets a user "change cities" by repointing
// their zip to a covered metro (matching + events + the metro label all key off
// zip, so this moves their whole pool). Every prefix here is in NE (010–069) or
// the NYC metro (100–119), so coordsForZip always resolves it.
export const METRO_ZIP: Record<Metro, string> = {
  boston: '02108', worcester: '01608', springfield: '01103', berkshires: '01201',
  capecod: '02601', southcoast: '02740', merrimack: '01852', providence: '02903',
  manchester: '03101', concord_nh: '03301', seacoast: '03801', portland_me: '04101',
  augusta: '04330', bangor: '04401', burlington: '05401', montpelier: '05602',
  hartford: '06103', newhaven: '06511', fairfield: '06901', easternct: '06320',
  nyc: '10001', longisland: '11550', westchester: '10601', northjersey: '07302',
}

// Nearest metro to a zip, or null if the zip is unknown / beyond range of
// every metro center.
export function metroOf(zip: string | null | undefined): Metro | null {
  if (!zip) return null
  const c = coordsForZip(zip)
  if (!c) return null
  let best: Metro | null = null
  let bestDist = Infinity
  for (const [key, m] of Object.entries(METRO_CENTERS)) {
    const d = haversine(c.lat, c.lng, m.lat, m.lng)
    if (d < bestDist) { bestDist = d; best = key as Metro }
  }
  // Label to the nearest metro within ~150mi (covers sparse northern ME/VT).
  return bestDist <= 150 ? best : null
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
