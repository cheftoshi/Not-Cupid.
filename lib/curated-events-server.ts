import 'server-only';
import catalog from '@/data/curated-events/published.json';
import { activeCuratedEvents, type CuratedRecord } from '@/lib/curated-events';
export function curatedCityEvents(metro: string) {
  return metro === 'boston' ? activeCuratedEvents(catalog as CuratedRecord[]) : [];
}
