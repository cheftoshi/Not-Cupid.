import { metroOf, METRO_CENTERS } from '@/lib/quiz-data';

// Map a ZIP to a human area label for the City Pulse view. Covers the
// Boston-metro towns/neighborhoods that make up the bulk of the pool; anything
// else falls back to its metro city (Worcester / Providence) or "Greater Boston".
const ZIP_AREA: Record<string, string> = {};
function add(area: string, zips: string[]) { for (const z of zips) ZIP_AREA[z] = area; }

add('Cambridge', ['02138', '02139', '02140', '02141', '02142', '02163']);
add('Somerville', ['02143', '02144', '02145']);
add('Allston/Brighton', ['02134', '02135']);
add('Back Bay', ['02116', '02199']);
add('Beacon Hill', ['02108', '02114']);
add('North End', ['02109', '02113']);
add('Downtown', ['02110', '02111', '02201', '02203']);
add('South End', ['02118']);
add('Fenway', ['02115', '02215']);
add('Charlestown', ['02129']);
add('East Boston', ['02128']);
add('South Boston', ['02127', '02210']);
add('Jamaica Plain', ['02130']);
add('Roxbury', ['02119', '02120', '02121']);
add('Dorchester', ['02122', '02124', '02125']);
add('Roslindale/West Roxbury', ['02131', '02132', '02136', '02126']);
add('Brookline', ['02445', '02446', '02447']);
add('Newton', ['02458', '02459', '02460', '02461', '02462', '02464', '02465', '02466', '02467', '02468']);
add('Watertown', ['02472']);
add('Belmont', ['02478']);
add('Arlington', ['02474', '02476']);
add('Medford', ['02155']);
add('Malden', ['02148']);
add('Everett', ['02149']);
add('Chelsea', ['02150']);
add('Revere', ['02151']);
add('Winthrop', ['02152']);
add('Quincy', ['02169', '02170', '02171']);
add('Milton', ['02186']);
add('Braintree', ['02184']);
add('Waltham', ['02451', '02452', '02453']);

export function neighborhoodOf(zip: string | null | undefined): string {
  if (!zip) return 'Greater Boston';
  if (ZIP_AREA[zip]) return ZIP_AREA[zip];
  const m = metroOf(zip);
  if (m && m !== 'boston' && METRO_CENTERS[m]) return METRO_CENTERS[m].city;
  return 'Greater Boston';
}
