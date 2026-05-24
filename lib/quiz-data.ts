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
    q: 'You find $200 cash on the ground at the airport. No one saw you. What do you do?',
    opts: [
      'Turn it in immediately. It\'s not mine.',
      '"I\'ll check if anyone\'s looking for it." (Wait 10 seconds, pocket it.)',
      'Keep it. The universe is redistributing wealth.',
      'Depends — am I at Logan or somewhere nicer?',
    ],
    score: [4, 2, 1, 2],
  },
  {
    dim: 'Honesty-Humility', short: 'Honesty',
    q: 'Someone you\'re not interested in buys you a drink. You:',
    opts: [
      'Accept it graciously and tell them you\'re seeing someone.',
      'Accept, enjoy the drink, give nothing back.',
      'Politely decline before they pay.',
      'Accept and then immediately find your friends.',
    ],
    score: [4, 1, 3, 2],
  },
  {
    dim: 'Honesty-Humility', short: 'Honesty',
    q: 'Your friend asks if their new haircut looks good. It really doesn\'t. You say:',
    opts: [
      'The truth, kindly. "It\'ll grow on me — and you."',
      'Something vague. "It\'s very... you."',
      'Full honesty, no filter.',
      'Whatever keeps the peace.',
    ],
    score: [4, 2, 3, 1],
  },
  {
    dim: 'Honesty-Humility', short: 'Honesty',
    q: 'At work, you accidentally get credit for someone else\'s idea. You:',
    opts: [
      'Correct it immediately, publicly if needed.',
      'Say something privately to the right person.',
      'Let it slide. It\'s complicated.',
      'Think: "Maybe I inspired it."',
    ],
    score: [4, 3, 1, 1],
  },

  // EMOTIONALITY
  {
    dim: 'Emotionality', short: 'Emotionality',
    q: 'A movie you\'ve seen three times comes on. You cry again. Your reaction?',
    opts: [
      'Embrace it. Emotional range is a feature.',
      'Try to hide it. Embarrassing.',
      'It\'s not crying, it\'s allergies. We don\'t discuss this.',
      'I don\'t rewatch movies.',
    ],
    score: [4, 2, 1, 3],
  },
  {
    dim: 'Emotionality', short: 'Emotionality',
    q: 'Someone you care about is going through something hard. You:',
    opts: [
      'Drop everything. I\'m there.',
      'Check in regularly, don\'t crowd them.',
      'Send a meme that says "thinking of you."',
      'Offer practical help — food, errands, logistics.',
    ],
    score: [4, 3, 2, 3],
  },
  {
    dim: 'Emotionality', short: 'Emotionality',
    q: 'How do you handle your own anxiety?',
    opts: [
      'Talk it through with someone I trust.',
      'Journal, walk, process alone.',
      'Distract myself until it passes.',
      'What anxiety? I just push through.',
    ],
    score: [4, 3, 2, 1],
  },
  {
    dim: 'Emotionality', short: 'Emotionality',
    q: 'When you\'re in a new place, how quickly do you feel at home?',
    opts: [
      'Quickly — I make anywhere feel like home.',
      'Once I find my spots and routines.',
      'Takes a while. I\'m particular.',
      'I\'m never fully home anywhere, honestly.',
    ],
    score: [4, 3, 2, 1],
  },

  // EXTRAVERSION
  {
    dim: 'Extraversion', short: 'Extraversion',
    q: 'It\'s Friday night. You have nothing planned. Your ideal scenario:',
    opts: [
      'Last-minute plans with whoever\'s free. Let\'s go.',
      'One good friend, a bottle of wine, a long conversation.',
      'The couch. Zero apologies.',
      'A solo adventure — restaurant, movie, walk.',
    ],
    score: [4, 3, 1, 2],
  },
  {
    dim: 'Extraversion', short: 'Extraversion',
    q: 'At a party where you know 3 people, you:',
    opts: [
      'Work the room. I\'ll know 10 by midnight.',
      'Stick with who I know, but have a great time.',
      'Find one interesting person and talk to them all night.',
      'Locate the dog and stay there.',
    ],
    score: [4, 3, 2, 1],
  },
  {
    dim: 'Extraversion', short: 'Extraversion',
    q: 'Your social battery is best described as:',
    opts: [
      'Solar-powered. People charge me.',
      'Decent, but needs regular recharging.',
      'A 2015 MacBook. Works, but finicky.',
      'Best described as "please stop."',
    ],
    score: [4, 3, 2, 1],
  },
  {
    dim: 'Extraversion', short: 'Extraversion',
    q: 'You\'re at a dinner and the conversation dies. You:',
    opts: [
      'Jump in with something. I love this part.',
      'Ask a question to get it going.',
      'Wait to see if someone else picks it up.',
      'Eat faster.',
    ],
    score: [4, 3, 2, 1],
  },

  // AGREEABLENESS
  {
    dim: 'Agreeableness', short: 'Agreeableness',
    q: 'Someone cuts you in line at Dunkin\'. You:',
    opts: [
      'Say something immediately. This is Boston.',
      'Silently seethe but do nothing.',
      'Let it go. The coffee isn\'t worth it.',
      'Cut them back. Symmetry.',
    ],
    score: [2, 1, 4, 1],
  },
  {
    dim: 'Agreeableness', short: 'Agreeableness',
    q: 'In a disagreement, you tend to:',
    opts: [
      'Hold my position until I see a genuinely better argument.',
      'Find middle ground quickly. I hate conflict.',
      'Dig in. Changing my mind feels like losing.',
      'Hear them out fully before I respond.',
    ],
    score: [3, 2, 1, 4],
  },
  {
    dim: 'Agreeableness', short: 'Agreeableness',
    q: 'A friend cancels plans last minute for the third time. You:',
    opts: [
      'Have a real conversation about it.',
      'Quietly start being less available.',
      'Let it go. People are going through things.',
      'Make a joke about it and move on.',
    ],
    score: [4, 2, 3, 1],
  },
  {
    dim: 'Agreeableness', short: 'Agreeableness',
    q: 'Someone you\'re on a date with is rude to the server. You:',
    opts: [
      'Address it directly at the table.',
      'Mentally end the date but finish dinner.',
      'Leave. No second date.',
      'Give them the benefit of the doubt once.',
    ],
    score: [4, 2, 3, 1],
  },

  // CONSCIENTIOUSNESS
  {
    dim: 'Conscientiousness', short: 'Conscientiousness',
    q: 'Your idea of a perfect Sunday in Boston:',
    opts: [
      'Planned: brunch at 11, walk at 1, dinner at 7.',
      'Loose intentions, beautiful outcomes.',
      'Wherever the group chat takes me.',
      'Alone, quiet, no agenda.',
    ],
    score: [4, 3, 2, 1],
  },
  {
    dim: 'Conscientiousness', short: 'Conscientiousness',
    q: 'Your phone\'s home screen is:',
    opts: [
      'Organized by category. Color-coded, maybe.',
      'A few apps I use, everything else in folders.',
      'Chaos. I know where everything is.',
      'What do you mean "organized"?',
    ],
    score: [4, 3, 2, 1],
  },
  {
    dim: 'Conscientiousness', short: 'Conscientiousness',
    q: 'You\'re running 10 minutes late. You:',
    opts: [
      'Text immediately. Lateness requires explanation.',
      'Show up and apologize once, sincerely.',
      'Arrive and just start talking. Time is fluid.',
      'Stress-spiral for 20 minutes beforehand.',
    ],
    score: [4, 3, 1, 2],
  },
  {
    dim: 'Conscientiousness', short: 'Conscientiousness',
    q: 'When you start something new, you:',
    opts: [
      'Research it extensively before beginning.',
      'Get the basics, figure out the rest as I go.',
      'Dive in and course-correct.',
      'Ask someone who already knows.',
    ],
    score: [4, 3, 2, 2],
  },

  // OPENNESS
  {
    dim: 'Openness', short: 'Openness',
    q: 'A stranger sits next to you on the T. They\'re reading a book you love. You:',
    opts: [
      'Say something. Life is short.',
      'Mention it if they make eye contact first.',
      'Silently bond from a distance.',
      'Wrong. I don\'t take the T.',
    ],
    score: [4, 3, 2, 1],
  },
  {
    dim: 'Openness', short: 'Openness',
    q: 'Your taste in music is best described as:',
    opts: [
      'Genuinely eclectic. I\'ll defend any of it.',
      'A few genres I love, deeply.',
      'Whatever\'s on. I\'m not precious about it.',
      'Extremely specific and slightly embarrassing.',
    ],
    score: [4, 3, 2, 3],
  },
  {
    dim: 'Openness', short: 'Openness',
    q: 'You\'re handed a menu at a restaurant you\'ve never been to. You:',
    opts: [
      'Order something you\'ve never had. Obviously.',
      'Find the thing closest to what you love.',
      'Ask the server what they\'d get.',
      'Order the burger. Safe is good.',
    ],
    score: [4, 2, 3, 1],
  },
  {
    dim: 'Openness', short: 'Openness',
    q: 'Your relationship with "weird" is:',
    opts: [
      'It\'s my brand. Lean in.',
      'I appreciate it in others. Moderate in myself.',
      'Weird is relative. I\'m just misunderstood.',
      'I prefer "unconventional."',
    ],
    score: [4, 3, 2, 3],
  },
]

export const ARCHETYPES: Archetype[] = [
  {
    name: 'The Curious Realist',
    tag: 'High Openness · Grounded Honesty',
    desc: 'You see the world clearly and still find it interesting. The algorithm matched you with someone who can keep up intellectually and won\'t sugarcoat anything.',
  },
  {
    name: 'The Principled Adventurer',
    tag: 'Strong Values · Genuine Curiosity',
    desc: 'Strong moral compass, real appetite for novelty. A rare combination. Your match challenges you without compromising who you are.',
  },
  {
    name: 'The Warm Skeptic',
    tag: 'High Emotionality · Selective Trust',
    desc: 'Emotionally intelligent, selectively trusting. You care deeply about the right people. Your match had to clear a bar. They did.',
  },
  {
    name: 'The Grounded Optimist',
    tag: 'Conscientious · Quietly Open',
    desc: 'You make things work and don\'t make a big deal about it. Your match appreciates reliability and won\'t mistake it for boring.',
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

export const LOADING_STEPS = [
  'Analyzing personality matrix...',
  'Scoring 6 behavioral dimensions...',
  'Searching Boston dating pool...',
  'Calculating compatibility vectors...',
  'Cross-referencing honesty scores...',
  'Your match is almost ready...',
]

// Zip code validation
export const BOSTON_CENTER = { lat: 42.3601, lng: -71.0589 }
export const RADIUS_MILES = 50

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
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

export function validateZip(zip: string): 'valid' | 'invalid' | 'outofrange' | 'incomplete' {
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

export function pickArchetype(scores: Record<Dimension, number>): Archetype {
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
