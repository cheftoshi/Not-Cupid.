export type DatePlanRow = {
  id: string; host_id: string; guest_id: string | null; state: string; mode: string;
  title: string; body: string | null; area: string; venue: string | null; metro: string;
  genders: string[]; happens_at: string | null; expires_at: string; created_at: string; is_test: boolean;
};
export type PlanPerson = { id: string; name?: string; age?: number; gender?: string; photo_url?: string; bio?: string; hobbies?: string[]; is_test?: boolean };
export function dateParticipant(p: DatePlanRow, userId: string) { return p.host_id === userId || p.guest_id === userId; }
export function dateRequestEligible(p: DatePlanRow, user: PlanPerson, now = Date.now()) {
  return p.state === 'open' && p.host_id !== user.id && (user.is_test === true) === p.is_test
    && (user.age || 0) >= 18 && !!user.gender && p.genders.includes(user.gender)
    && Date.parse(p.expires_at) > now && (!p.happens_at || Date.parse(p.happens_at) > now);
}
export function publicDatePerson(person: PlanPerson, hidden: boolean) {
  return { name: hidden ? 'A little mystery' : (person.name || 'A member').split(' ')[0], age: person.age,
    gender: person.gender, photo: hidden ? null : person.photo_url || null,
    bio: hidden ? null : person.bio || null, interests: (person.hobbies || []).slice(0, 5) };
}
export function dateVenue(p: DatePlanRow, userId: string) { return dateParticipant(p, userId) ? p.venue : null; }
