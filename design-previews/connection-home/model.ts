// UI-review sandbox only. No production authorization or persistence.
export type Gender = 'Woman' | 'Man' | 'Nonbinary';
export type Person = { id: string; name: string; age: number; gender: Gender; seeks: Gender[]; bio: string; interests: string[]; color: string };
export type PlanLocation = { neighborhood: string; venue: string | null; visibility: 'public' | 'participants' };
export type LocationDraft = { neighborhood: string; choice: 'together' | 'venue'; venue: string; visibility: 'public' | 'participants'; publicPlace: boolean };
export const neighborhoods = ['Back Bay', 'Beacon Hill', 'Downtown', 'South End', 'Jamaica Plain', 'Fenway', 'North End', 'South Boston', 'Dorchester', 'Allston', 'Brighton', 'Charlestown', 'East Boston', 'Roxbury', 'Roslindale', 'West Roxbury', 'Hyde Park', 'Mattapan', 'Mission Hill'];
export function newLocationDraft(neighborhood = 'Back Bay'): LocationDraft { return {neighborhood,choice:'together',venue:'',visibility:'participants',publicPlace:false}; }
export function saveLocation(draft: LocationDraft, kind: 'friends' | 'date'): PlanLocation {
  const neighborhood = draft.neighborhood.trim();
  if(!neighborhoods.includes(neighborhood)) throw Error('Choose a Boston neighborhood.');
  const venue = draft.choice==='venue' ? draft.venue.trim() : null;
  if(draft.choice==='venue' && (!venue || venue.length>120)) throw Error('Enter a public meeting place, or choose Decide together.');
  if(draft.choice==='venue' && !draft.publicPlace) throw Error('Confirm this is a public meeting place, not a home address.');
  return {neighborhood,venue,visibility:kind==='date'?'participants':draft.visibility};
}
export type Invitation = { id: string; owner: string; title: string; body: string; location: PlanLocation; time: string; kind: 'friends' | 'date'; category: string; capacity: number; members: string[]; mode?: 'profile' | 'blind'; seeks?: Gender[]; requests: { user: string; status: 'pending' | 'accepted' | 'passed' }[]; confirmed?: string };
export const people: Record<string, Person> = {
  jamie: {id:'jamie',name:'Jamie',age:27,gender:'Woman',seeks:['Man'],bio:'Usually finding a new coffee spot or an excuse to be outside.',interests:['Coffee','Long walks','Live music'],color:'#f3d7c6'},
  noah: {id:'noah',name:'Noah',age:29,gender:'Man',seeks:['Woman'],bio:'Weekend cook, weekday walker. Looking for an easy conversation, not a perfect opening line.',interests:['Coffee','Cooking','Live music'],color:'#d4dfed'},
  taylor: {id:'taylor',name:'Taylor',age:28,gender:'Woman',seeks:['Man','Nonbinary'],bio:'New places, good books, and small adventures.',interests:['Books','Tennis','Coffee'],color:'#e2d8ed'},
  alex: {id:'alex',name:'Alex',age:30,gender:'Nonbinary',seeks:['Woman','Man','Nonbinary'],bio:'Always up for a little fresh air.',interests:['Walks','Art'],color:'#dce5ce'},
};
export function seedInvitations(): Invitation[] { return [
  {id:'walk',owner:'alex',title:'A walk, a coffee, no big agenda.',body:'An easy loop around the Common. Come for the fresh air, stay for the conversation.',location:{neighborhood:'Downtown',venue:'Boston Common · Park Street entrance',visibility:'public'},time:'Tomorrow · 5:30 PM',kind:'friends',category:'OUTSIDE',capacity:4,members:['alex'],requests:[]},
  {id:'lunch',owner:'taylor',title:'A small table. A few new faces.',body:'Sunday lunch in the South End. Nothing fancy, just good company.',location:{neighborhood:'South End',venue:'Sample café · Tremont Street',visibility:'participants'},time:'This Sunday · 12:30 PM',kind:'friends',category:'FOOD & COFFEE',capacity:4,members:['taylor','jamie','alex'],requests:[]},
  {id:'coffee-date',owner:'noah',title:'Coffee, then see where the conversation goes.',body:'A relaxed first date at a public café. Let’s get to know each other.',location:{neighborhood:'Back Bay',venue:'Sample café · Newbury Street',visibility:'participants'},time:'Saturday · time together',kind:'date',category:'COFFEE DATE',capacity:2,members:['noah'],mode:'profile',seeks:['Woman'],requests:[]},
  {id:'blind-date',owner:'noah',title:'A little mystery. A good conversation.',body:'A blind coffee date. Let’s choose the connection before the photo.',location:{neighborhood:'Beacon Hill',venue:null,visibility:'participants'},time:'Find a time together',kind:'date',category:'BLIND DATE',capacity:2,members:['noah'],mode:'blind',seeks:['Woman'],requests:[]},
]; }
export function dateEligible(plan: Invitation, viewer: Person) {
  const host=people[plan.owner];
  return plan.kind==='date' && !!host && viewer.id!==host.id && viewer.age>=18 && host.age>=18
    && !!plan.seeks?.includes(viewer.gender) && viewer.seeks.includes(host.gender);
}
export function visibleTo(plan: Invitation, viewer: string) {
  return plan.kind!=='date' || !plan.confirmed || plan.owner===viewer || plan.confirmed===viewer;
}
export function canChat(plan: Invitation, viewer: string) {
  return plan.kind==='date' ? !!plan.confirmed && (plan.owner===viewer || plan.confirmed===viewer) : plan.members.includes(viewer);
}
// Rendering policy only. Production must redact the API payload on the server.
export function locationFor(plan: Invitation, viewer: string) {
  const {neighborhood,venue,visibility}=plan.location;
  const allowed=visibleTo(plan,viewer) && (plan.owner===viewer || (plan.kind==='date' ? !!plan.confirmed&&plan.confirmed===viewer : visibility==='public'||plan.members.includes(viewer)));
  return {neighborhood,venue:allowed?venue:null,status:!venue?'decide':allowed?'visible':'hidden'} as const;
}
export function acceptDate(plan: Invitation, actor: string, guest: string): Invitation {
  if(plan.kind!=='date' || actor!==plan.owner || plan.confirmed || !people[guest] || !dateEligible(plan,people[guest]) || !plan.requests.some(r=>r.user===guest && r.status==='pending')) return plan;
  return {...plan,capacity:2,confirmed:guest,members:[plan.owner,guest],requests:plan.requests.map(r=>({...r,status:r.user===guest?'accepted':'passed'}))};
}
