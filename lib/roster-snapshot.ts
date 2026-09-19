// A fresh but short roster may GROW without losing any old member. Every
// displayed backfill must be saved so the pick endpoint recognizes it.
export function rosterSnapshotChanged(prior: readonly string[], current: readonly string[]): boolean {
  return prior.length !== current.length || prior.some((id, index) => id !== current[index]);
}
