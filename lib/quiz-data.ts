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
  'Honesty-Humility',
  'Emotionality',
  'Extraversion',
  'Agreeableness',
  'Conscientiousness',
  'Openness',
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

  // HONESTY-HUMILITY
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

  // EMOTIONALITY
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

  // EXTRAVERSION
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

  // AGREEABLENESS
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

  // CONSCIENTIOUSNESS
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

  // OPENNESS
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
]

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
export const RADIUS_MILES = 50

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

export const ZIP_COORDS: Record<string, { lat: number; lng: number }> = {
  '02101':{lat:42.3601,lng:-71.0589},'02108':{lat:42.3588,lng:-71.0631},'02109':{lat:42.3603,lng:-71.0511},
  '02110':{lat:42.3557,lng:-71.0521},'02111':{lat:42.3513,lng:-71.0589},'02113':{lat:42.3647,lng:-71.0530},
  '02114':{lat:42.3616,lng:-71.0680},'02115':{lat:42.3422,lng:-71.0985},'02116':{lat:42.3488,lng:-71.0807},
  '02118':{lat:42.3376,lng:-71.0726},'02119':{lat:42.3143,lng:-71.0868},'02120':{lat:42.3297,lng:-71.0991},
  '02121':{lat:42.3043,lng:-71.0812},'02122':{lat:42.2852,lng:-71.0513},'02124':{lat:42.2799,lng:-71.0706},
  '02125':{lat:42.3083,lng:-71.0578},'02126':{lat:42.2702,lng:-71.0896},'02127':{lat:42.3327,lng:-71.0413},
  '02128':{lat:42.3696,lng:-71.0097},'02129':{lat:42.3823,lng:-71.0604},'02130':{lat:42.3072,lng:-71.1133},
  '02131':{lat:42.2826,lng:-71.1198},'02132':{lat:42.2791,lng:-71.1543},'02134':{lat:42.3535,lng:-71.1321},
  '02135':{lat:42.3551,lng:-71.1546},'02136':{lat:42.2554,lng:-71.1230},'02138':{lat:42.3765,lng:-71.1244},
  '02139':{lat:42.3650,lng:-71.1031},'02140':{lat:42.3924,lng:-71.1296},'02141':{lat:42.3698,lng:-71.0782},
  '02142':{lat:42.3626,lng:-71.0827},'02143':{lat:42.3791,lng:-71.0997},'02144':{lat:42.3985,lng:-71.1219},
  '02145':{lat:42.3876,lng:-71.0793},'02148':{lat:42.4251,lng:-71.0660},'02149':{lat:42.4040,lng:-71.0545},
  '02150':{lat:42.3860,lng:-71.0211},'02151':{lat:42.4087,lng:-71.0109},'02152':{lat:42.3485,lng:-70.9787},
  '02155':{lat:42.4220,lng:-71.1068},'02163':{lat:42.3660,lng:-71.1185},'02169':{lat:42.2513,lng:-71.0029},
  '02170':{lat:42.2671,lng:-71.0232},'02171':{lat:42.2792,lng:-71.0135},'02176':{lat:42.4603,lng:-71.0669},
  '02180':{lat:42.4762,lng:-71.1017},'02184':{lat:42.2187,lng:-71.0034},'02186':{lat:42.2496,lng:-71.1190},
  '02188':{lat:42.2262,lng:-71.0427},'02189':{lat:42.2074,lng:-71.0201},'02190':{lat:42.1956,lng:-70.9913},
  '02191':{lat:42.2254,lng:-70.9609},'02210':{lat:42.3479,lng:-71.0448},'02215':{lat:42.3481,lng:-71.1025},
  '01803':{lat:42.4970,lng:-71.1398},'01801':{lat:42.4793,lng:-71.1773},'01880':{lat:42.5284,lng:-71.0645},
  '01702':{lat:42.2767,lng:-71.4165},'01760':{lat:42.2948,lng:-71.3495},'01701':{lat:42.2793,lng:-71.4162},
  '01720':{lat:42.4860,lng:-71.4337},'01721':{lat:42.2454,lng:-71.4263},'02301':{lat:42.0834,lng:-71.0184},
  '02302':{lat:42.0724,lng:-70.9943},'02324':{lat:41.9954,lng:-70.9776},'02346':{lat:41.9407,lng:-70.8487},
  '02050':{lat:42.0940,lng:-70.7229},'01742':{lat:42.4604,lng:-71.5534},'01886':{lat:42.5317,lng:-71.3796},
  '01887':{lat:42.5348,lng:-71.3285},'01810':{lat:42.6584,lng:-71.1437},'01821':{lat:42.5445,lng:-71.2759},
  '01824':{lat:42.5998,lng:-71.3668},'01826':{lat:42.6645,lng:-71.2982},'01851':{lat:42.6334,lng:-71.3162},
  '01852':{lat:42.6501,lng:-71.3101},'01854':{lat:42.6418,lng:-71.3654},'01862':{lat:42.6960,lng:-71.3204},
  '01863':{lat:42.6743,lng:-71.3765},'01864':{lat:42.7310,lng:-71.0767},
}

export function validateZip(zip: string): 'valid'|'invalid'|'outofrange'|'incomplete' {
  if (zip.length < 5) return 'incomplete'
  const coords = ZIP_COORDS[zip]
  if (!coords) return 'invalid'
  const dist = haversine(BOSTON_CENTER.lat, BOSTON_CENTER.lng, coords.lat, coords.lng)
  return dist <= RADIUS_MILES ? 'valid' : 'outofrange'
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
