export type VenueVisibility = 'public' | 'participants';
export type PlanLocationInput = { area: string; location: string | null; visibility: VenueVisibility };

export function validatePlanLocation(body: Record<string, unknown>, allowedAreas: string[]): PlanLocationInput {
  const area = typeof body.area === 'string' ? body.area.trim() : '';
  if (!area || !allowedAreas.includes(area)) throw Error('Choose a neighborhood in your current city.');
  const location = typeof body.location === 'string' ? body.location.trim() : '';
  if (location.length > 120) throw Error('Keep the meeting place under 120 characters.');
  if (location && body.public_place !== true) throw Error('Confirm that this is a public meeting place, not a home address.');
  if (body.visibility !== 'public' && body.visibility !== 'participants') throw Error('Choose who can see the meeting place.');
  return { area, location: location || null, visibility: body.visibility };
}

export function visiblePlanVenue(venue: { venue: string | null; visibility: string } | undefined, legacy: string | null, isHost: boolean, response: string | null) {
  if (!venue) return { location: legacy, locationVisibility: 'public' as VenueVisibility, locationHidden: false };
  const allowed = isHost || response === 'yes' || venue.visibility === 'public';
  return { location: allowed ? venue.venue : null, locationVisibility: venue.visibility as VenueVisibility, locationHidden: !!venue.venue && !allowed };
}
