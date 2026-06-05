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

// ── New England metros beyond Boston (added with the region-wide expansion) ──
// Rhode Island
add('Providence', ['02903', '02904', '02905', '02906', '02907', '02908', '02909']);
add('Pawtucket', ['02860', '02861']);
add('Cranston', ['02910', '02920', '02921']);
add('Warwick', ['02886', '02888', '02889']);
add('Newport', ['02840', '02842']);
// Connecticut — Hartford
add('Hartford', ['06103', '06105', '06106', '06112', '06114', '06120']);
add('West Hartford', ['06107', '06110', '06117', '06119']);
add('New Britain', ['06051', '06052', '06053']);
add('Manchester (CT)', ['06040', '06042']);
// Connecticut — New Haven
add('New Haven', ['06510', '06511', '06513', '06515', '06519']);
add('Hamden', ['06514', '06517', '06518']);
// Connecticut — Fairfield County
add('Stamford', ['06901', '06902', '06905', '06906']);
add('Norwalk', ['06850', '06851', '06854', '06855']);
add('Bridgeport', ['06604', '06605', '06606', '06608']);
// Maine
add('Portland (ME)', ['04101', '04102', '04103']);
add('South Portland', ['04106']);
add('Westbrook', ['04092']);
// Vermont
add('Burlington', ['05401', '05405', '05408']);
add('South Burlington', ['05403']);
add('Winooski', ['05404']);
// New Hampshire
add('Manchester (NH)', ['03101', '03102', '03103', '03104']);
add('Nashua', ['03060', '03062', '03063', '03064']);
add('Concord (NH)', ['03301', '03303']);
// Western / Central Massachusetts
add('Worcester', ['01602', '01603', '01604', '01605', '01606', '01607', '01608', '01609', '01610']);
add('Springfield', ['01103', '01104', '01105', '01107', '01108', '01109', '01118', '01119']);
add('Chicopee', ['01013', '01020']);
add('Holyoke', ['01040']);

export function neighborhoodOf(zip: string | null | undefined): string {
  if (!zip) return 'Greater Boston';
  if (ZIP_AREA[zip]) return ZIP_AREA[zip];
  const m = metroOf(zip);
  if (m && METRO_CENTERS[m]) return METRO_CENTERS[m].city; // metro city for unmapped zips
  return 'Greater Boston';
}

// Distinct area labels for the activity-board picker — neighborhoods + every
// metro city, so anyone in New England has a sensible area to choose.
export const NEIGHBORHOODS: string[] = Array.from(new Set([
  ...Object.values(ZIP_AREA),
  ...Object.values(METRO_CENTERS).map((m) => m.city),
  'Greater Boston',
])).sort();
