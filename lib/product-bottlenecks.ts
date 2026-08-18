export type BottleneckSeverity = 'critical' | 'high' | 'watch';
export type BottleneckArea = 'acquisition' | 'activation' | 'love' | 'friend' | 'revenue' | 'reliability' | 'ai';

export type ProductBottleneck = {
  id: string;
  area: BottleneckArea;
  severity: BottleneckSeverity;
  title: string;
  evidence: string;
  diagnosis: string;
  nextAction: string;
  metric: { value: number; unit: 'count' | 'percent' | 'milliseconds'; target: string };
};

type SnapshotInput = {
  measuredAt?: string;
  onlyInBoston?: any;
  loveUsage?: any;
  loveFunnel?: any;
  appExperience?: any;
  monetization?: any;
  friend?: any;
};

const pct = (numerator: number, denominator: number) => denominator > 0
  ? Math.round((numerator / denominator) * 100)
  : 0;

const severityRank: Record<BottleneckSeverity, number> = { critical: 3, high: 2, watch: 1 };

export function detectProductBottlenecks(input: SnapshotInput) {
  const items: ProductBottleneck[] = [];
  const add = (item: ProductBottleneck) => items.push(item);
  const love = input.loveFunnel;
  const usage7d = input.loveUsage?.last7d;
  const acquisition = input.onlyInBoston;
  const experience = input.appExperience;
  const revenue = input.monetization;
  const friend = input.friend;

  if (love?.activePool >= 20) {
    const uncoveredPct = pct(love.activePoolWithoutLiveConnection, love.activePool);
    if (uncoveredPct >= 35) add({
      id: 'love-connection-coverage',
      area: 'love',
      severity: uncoveredPct >= 60 ? 'critical' : 'high',
      title: 'Active daters are leaving without a live connection',
      evidence: `${love.activePoolWithoutLiveConnection} of ${love.activePool} active-pool users (${uncoveredPct}%) have no live connection.`,
      diagnosis: 'The pool has attention, but reciprocal inventory, eligibility, capacity, or roster-to-pick activation is not converting enough people into a live choice.',
      nextAction: 'Segment the uncovered pool by gender, seeking preference, age band and metro; distinguish no eligible candidates from candidates shown but not chosen.',
      metric: { value: uncoveredPct, unit: 'percent', target: 'below 35%' },
    });
  }

  if (love?.oneSidedConnections > 0) {
    const agedPct = pct(love.unanswered24h, love.oneSidedConnections);
    if (love.unanswered24h >= 3 && agedPct >= 25) add({
      id: 'love-decision-latency',
      area: 'love',
      severity: agedPct >= 50 ? 'critical' : 'high',
      title: 'One-sided choices are not becoming decisions',
      evidence: `${love.unanswered24h} of ${love.oneSidedConnections} one-sided connections (${agedPct}%) have waited at least 24 hours; ${love.unanswered48h} have waited 48 hours.`,
      diagnosis: 'People are choosing, but recipients are not reaching or completing the Yes/Pass decision quickly enough.',
      nextAction: 'Measure reminder delivery → open → decision by channel, keep the decision screen one tap, and expire unanswered choices cleanly at 72 hours.',
      metric: { value: agedPct, unit: 'percent', target: 'below 25% at 24h' },
    });
  }

  if (love?.mutualConnections >= 3) {
    const silentPct = pct(love.mutualWithoutMessage, love.mutualConnections);
    if (silentPct >= 25) add({
      id: 'love-mutual-to-message',
      area: 'activation',
      severity: silentPct >= 50 ? 'high' : 'watch',
      title: 'Mutual connections are stalling before the first message',
      evidence: `${love.mutualWithoutMessage} of ${love.mutualConnections} live mutual connections (${silentPct}%) have no message.`,
      diagnosis: 'A mutual match is being treated as the finish line instead of the start of a conversation.',
      nextAction: 'Open directly into a contextual first move, compare coach-assisted versus unassisted first-message and reply rates, and keep all sending user-controlled.',
      metric: { value: silentPct, unit: 'percent', target: 'below 25%' },
    });
  }

  if (love?.activePool >= 20 && usage7d) {
    const pickerPct = pct(usage7d.pickers, love.activePool);
    if (pickerPct < 35) add({
      id: 'love-roster-to-pick',
      area: 'activation',
      severity: pickerPct < 20 ? 'critical' : 'high',
      title: 'Too few active daters are making a roster choice',
      evidence: `${usage7d.pickers} people picked in seven days against an active pool of ${love.activePool} (${pickerPct}%).`,
      diagnosis: 'The roster may be missing fit, sufficient profile evidence, a clear next step, or enough urgency to make a decision.',
      nextAction: 'Track roster open → profile open → pick attempt per candidate position, then test one concise AI recommendation with an explanation—not more profiles.',
      metric: { value: pickerPct, unit: 'percent', target: 'at least 35% weekly' },
    });
  }

  if (love?.notifications) {
    const attempted = Number(love.notifications.immediateSent ?? 0)
      + Number(love.notifications.reminder24hSent ?? 0)
      + Number(love.notifications.finalSent ?? 0)
      + Number(love.notifications.mutualNoMessage12hSent ?? 0);
    const terminal = Number(love.notifications.delivered ?? 0) + Number(love.notifications.failed ?? 0);
    if (attempted >= 10 && terminal === 0) add({
      id: 'notification-observability',
      area: 'reliability',
      severity: 'critical',
      title: 'Notification outcomes are not observable',
      evidence: `${attempted} Love emails are recorded as sent, but zero are recorded delivered or failed.`,
      diagnosis: 'The send path is running, but provider webhook/status reconciliation cannot prove delivery or engagement.',
      nextAction: 'Verify Resend webhook events and delivery-ledger reconciliation before judging reminder copy or sending more volume.',
      metric: { value: terminal, unit: 'count', target: 'every send reaches delivered or failed' },
    });
  }

  if (acquisition?.campaignActive === true && acquisition.launchWindowSessions >= 20) {
    const directPct = pct(acquisition.attributedSessions, acquisition.launchWindowSessions);
    if (directPct < 25) add({
      id: 'campaign-attribution',
      area: 'acquisition',
      severity: directPct === 0 ? 'critical' : 'high',
      title: 'Campaign traffic cannot be directly attributed',
      evidence: `${acquisition.attributedSessions} of ${acquisition.launchWindowSessions} launch-window sessions (${directPct}%) retained the campaign tag.`,
      diagnosis: 'Traffic is moving, but social redirects, copied links, or untagged placements are stripping the source needed to measure acquisition quality.',
      nextAction: 'Use one short redirect per placement, verify it before every post, and persist first-touch attribution through login, signup and experiment entry.',
      metric: { value: directPct, unit: 'percent', target: 'at least 75% tagged' },
    });

    const entryPct = pct(acquisition.launchWindowEntries, acquisition.launchWindowSessions);
    if (entryPct < 5) add({
      id: 'campaign-visit-to-entry',
      area: 'acquisition',
      severity: entryPct < 2 ? 'high' : 'watch',
      title: 'Launch traffic is not reaching experiment entry',
      evidence: `${acquisition.launchWindowEntries} entries from ${acquisition.launchWindowSessions} launch-window sessions (${entryPct}%, directional).`,
      diagnosis: 'The landing, signup, profile-completion, or experiment form is losing people before the final entry—not necessarily at one single screen.',
      nextAction: 'Use the first-party campaign ledger to rank the largest step-to-step drop and fix only that step before adding more acquisition spend.',
      metric: { value: entryPct, unit: 'percent', target: 'at least 5% directional visit-to-entry' },
    });
  }

  if (revenue?.paywallViewers >= 20 && revenue.checkoutStarters === 0) add({
    id: 'paywall-to-checkout',
    area: 'revenue',
    severity: 'critical',
    title: 'Paywall exposure is producing no checkout intent',
    evidence: `${revenue.paywallViewers} unique paywall viewers and zero checkout starters in ${revenue.periodDays ?? 30} days.`,
    diagnosis: 'The value proposition, timing, price framing, checkout handoff, or telemetry is failing before payment begins.',
    nextAction: 'Separate each product surface, verify checkout instrumentation end to end, and test value after users experience the free core—not before trust exists.',
    metric: { value: 0, unit: 'percent', target: 'first reach 5% view-to-checkout' },
  });

  if (friend?.optedIn >= 20 && friend.connectionActionUsers30d != null) {
    const actionPct = pct(friend.connectionActionUsers30d, friend.optedIn);
    if (actionPct < 20) add({
      id: 'friend-intent-to-action',
      area: 'friend',
      severity: actionPct < 10 ? 'high' : 'watch',
      title: 'Friend opt-ins are not becoming connection actions',
      evidence: `${friend.connectionActionUsers30d} of ${friend.optedIn} Friend users (${actionPct}%) took a connection action in 30 days.`,
      diagnosis: 'Discovery is present, but the path from browsing to joining, messaging, or making a plan is too weak.',
      nextAction: 'Make the concierge recommend one real action today and measure RSVP, join, DM, and plan creation rather than feed views.',
      metric: { value: actionPct, unit: 'percent', target: 'at least 20% monthly' },
    });
  }

  const perf = experience?.performance;
  if (perf) {
    const slowRoster = Number(perf.rosterApiP75Ms ?? 0) > 1500;
    const slowInteraction = Number(perf.inpP75Ms ?? 0) > 500;
    const errors = Number(perf.clientErrors ?? 0);
    if (slowRoster || slowInteraction || errors >= 5) add({
      id: 'pwa-performance',
      area: 'reliability',
      severity: errors >= 10 || Number(perf.rosterApiP75Ms ?? 0) > 3000 ? 'critical' : 'high',
      title: 'PWA responsiveness is adding interaction friction',
      evidence: `Roster API p75 ${perf.rosterApiP75Ms ?? '—'}ms · INP p75 ${perf.inpP75Ms ?? '—'}ms · ${errors} client errors in 24 hours.`,
      diagnosis: 'Slow or failing mobile interactions can look like low intent even when the underlying match is relevant.',
      nextAction: 'Trace the slowest roster query and top client-error signature, then verify the fix on an installed iPhone PWA.',
      metric: { value: Math.max(Number(perf.rosterApiP75Ms ?? 0), Number(perf.inpP75Ms ?? 0)), unit: 'milliseconds', target: 'roster below 1.5s and INP below 500ms' },
    });
  }

  const interactions = experience?.interactions;
  if (interactions?.profileOpens >= 20) {
    const readRequestPct = pct(interactions.compatibilityReadRequests, interactions.profileOpens);
    if (readRequestPct < 5) add({
      id: 'ai-read-discovery',
      area: 'ai',
      severity: 'watch',
      title: 'AI compatibility support is not being discovered',
      evidence: `${interactions.compatibilityReadRequests} AI-read requests from ${interactions.profileOpens} profile opens (${readRequestPct}%) in 24 hours.`,
      diagnosis: 'The new AI value may be too hidden, too early to judge, or insufficiently explained at the point of decision.',
      nextAction: 'Let the feature collect a full cohort before changing price; compare profile-open → AI-read-request → extra-pick → mutual outcomes.',
      metric: { value: readRequestPct, unit: 'percent', target: 'establish a 7-day baseline, then improve' },
    });
  }

  items.sort((a, b) => severityRank[b.severity] - severityRank[a.severity] || a.area.localeCompare(b.area));
  return {
    measuredAt: input.measuredAt ?? new Date().toISOString(),
    summary: {
      total: items.length,
      critical: items.filter((item) => item.severity === 'critical').length,
      high: items.filter((item) => item.severity === 'high').length,
      watch: items.filter((item) => item.severity === 'watch').length,
    },
    topPriority: items[0]?.id ?? null,
    items,
    method: 'Deterministic thresholds over aggregate product metrics. A flag is a diagnosis prompt, not an automatic product change.',
  };
}
