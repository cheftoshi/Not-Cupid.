// Mutual-profile privacy boundary. Every roster profile is free; the deeper
// gallery, lifestyle, values, and attachment context is included only after
// both people connect. No payment unlocks profile information.
export function freeLoveProfileView(user: any): any {
  return {
    ...user,
    // The human basics are always free. These mutual-only fields are kept out
    // of pending and historical non-mutual client payloads.
    gallery: [],
    vibes: null,
    values_profile: null,
    attach_style: null,
    attach_anxiety: null,
    attach_avoidance: null,
  };
}
