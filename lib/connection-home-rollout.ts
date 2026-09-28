// Server-only release controls. Disable without a destructive data rollback.
export function connectionHomeEnabled(metro: string | null) {
  if (process.env.CONNECTION_HOME_V2 === 'off') return false;
  const cities = (process.env.CONNECTION_HOME_V2_METROS || 'boston,nyc,providence').split(',').map(s => s.trim());
  return !!metro && (cities.includes('*') || cities.includes(metro));
}
