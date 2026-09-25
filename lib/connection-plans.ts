export type ConnectionPlan = {
  id: string; title: string; body?: string | null; kind: string; category: string;
  area?: string | null; location?: string | null; happens_at?: string | null;
  created_at: string; expires_at?: string | null; authorId: string; authorName: string;
  authorPhoto?: string | null; isMine: boolean; eligible: boolean; datingFriendly: boolean;
  capacity?: number | null; myResponse?: string | null; responses: { yes: number; maybe: number; no: number };
  locationVisibility?: 'public' | 'participants'; locationHidden?: boolean; distanceMiles?: number | null;
  locationAreas?: string[];
  connectionKind?: 'date'; dateMode?: 'profile' | 'blind'; state?: 'open' | 'confirmed' | 'cancelled'; canChat?: boolean;
  authorProfile?: DateProfile; partner?: DateProfile | null; audienceGender?: string[];
  requests?: {id:string;profile:DateProfile}[];
};
export type DateProfile = {name:string;age?:number;gender?:string;photo?:string|null;bio?:string|null;interests:string[]};
export function planChatAllowed(plan: ConnectionPlan) { return plan.connectionKind==='date' ? plan.canChat===true : plan.isMine || plan.myResponse==='yes'; }
export function planEndpoint(plan: ConnectionPlan) { return plan.connectionKind==='date' ? `/api/date-plans/${plan.id}` : `/api/friend/activities/${plan.id}`; }

export function initialPlanFilter(user: { friend_opted_in_at?: unknown; attach_style?: unknown }) {
  return user.friend_opted_in_at ? (user.attach_style ? 'all' : 'friends') : user.attach_style ? 'dating' : 'friends';
}

// The home feed is member-created plans, never imported event inventory or
// generic discussion posts. Old conversations remain reachable by deep link.
export function liveConnectionPlans(plans: ConnectionPlan[], now = Date.now()) {
  return plans.filter(plan => plan.kind === 'event'
    && plan.state !== 'cancelled' && plan.state !== 'confirmed'
    && (!plan.expires_at || Date.parse(plan.expires_at) > now)
    && (!plan.happens_at || Date.parse(plan.happens_at) > now))
    .sort((a, b) => (a.happens_at ? Date.parse(a.happens_at) : Infinity)
      - (b.happens_at ? Date.parse(b.happens_at) : Infinity)
      || Date.parse(b.created_at) - Date.parse(a.created_at));
}

export function planHasEnded(plan: Pick<ConnectionPlan, 'happens_at' | 'expires_at'>, now = Date.now()) {
  return !!((plan.happens_at && Date.parse(plan.happens_at) <= now)
    || (plan.expires_at && Date.parse(plan.expires_at) <= now));
}
