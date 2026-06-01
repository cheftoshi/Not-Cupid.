import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import MatchCard from './match-card';
import MatchReveal from './match-reveal';
import RosterPicker from './roster-picker';
import DashboardExtras from './dashboard-extras';
import Wordmark from '@/components/wordmark';
import CorpFooter from '@/components/corp-footer';
import { zipDistanceMiles, DEFAULT_MATCH_RADIUS, MAX_MATCH_RADIUS } from '@/lib/quiz-data';
import { recordUnlock } from '@/lib/record-unlock';
import styles from './dashboard.module.css';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { unlock_session?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/');
  if (!user.archetype) redirect('/quiz');

  // If returning from Stripe checkout, verify the payment inline
  if (searchParams.unlock_session) {
    try {
      const stripeRes = await fetch(
        `https://api.stripe.com/v1/checkout/sessions/${searchParams.unlock_session}`,
        { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }, cache: 'no-store' }
      );
      const session = await stripeRes.json();
      if (
        session.payment_status === 'paid' &&
        session.metadata?.user_id === user.id &&
        session.metadata?.type === 'match_unlock'
      ) {
        await recordUnlock({
          userId: user.id,
          matchId: session.metadata.match_id,
          unlockedUserId: session.metadata.unlocked_user_id,
          tier: session.metadata.unlock_tier === 'hexaco' ? 'hexaco' : 'profile',
          paymentId: session.payment_intent,
        });
      }
    } catch (e) {
      console.error('Unlock verification failed:', e);
    }
  }

  // Get current (non-ended) match
  const { data: rawMatch } = await supabaseAdmin
    .from('matches')
    .select('*')
    .or(`user_1_id.eq.${user.id},user_2_id.eq.${user.id}`)
    .is('ended_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // A match is "live" (shows the match card) only if it's both-accepted, OR
  // still within its accept window. A pending match that timed out (expires_at
  // passed, not yet swept by the cron) is NOT live — we fall through to the
  // roster so the user can pick again instead of staring at a dead card.
  const matchBothAccepted = !!(rawMatch && rawMatch.user_1_accepted && rawMatch.user_2_accepted);
  const terminalStatus = !!(rawMatch && ['expired', 'passed', 'ended'].includes(rawMatch.status));
  const matchTimedOut = !!(
    rawMatch && rawMatch.expires_at && new Date(rawMatch.expires_at) < new Date() && !matchBothAccepted
  );
  let currentMatch = rawMatch && !terminalStatus && !matchTimedOut ? rawMatch : null;

  let otherUser = null;
  let isUnlocked = false;
  let hexacoUnlocked = false;
  let profileUnlocked = false;

  if (currentMatch) {
    const otherId =
      currentMatch.user_1_id === user.id ? currentMatch.user_2_id : currentMatch.user_1_id;

    const { data } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', otherId)
      .single();
    otherUser = data;

    const { data: unlock } = await supabaseAdmin
      .from('match_unlocks')
      .select('hexaco_unlocked, profile_unlocked')
      .eq('user_id', user.id)
      .eq('match_id', currentMatch.id)
      .maybeSingle();
    profileUnlocked = !!unlock?.profile_unlocked;
    hexacoUnlocked = !!unlock?.hexaco_unlocked || profileUnlocked;
    isUnlocked = profileUnlocked; // back-compat for any consumer still reading it

    // Realm segregation: only show a match within the viewer's realm (real
    // users never see a test match; test accounts only see other test accounts).
    if (otherUser && (((otherUser as any).is_test === true) !== ((user as any).is_test === true))) {
      currentMatch = null; otherUser = null;
    }
  }


  // History (ended matches)
  const { data: historyMatches } = await supabaseAdmin
    .from('matches')
    .select('*')
    .or(`user_1_id.eq.${user.id},user_2_id.eq.${user.id}`)
    .not('ended_at', 'is', null)
    .order('ended_at', { ascending: false })
    .limit(10);

  // Names of past matches (we show who, not why it ended).
  const historyOtherIds = Array.from(new Set(
    (historyMatches ?? []).map((m: any) => (m.user_1_id === user.id ? m.user_2_id : m.user_1_id))
  ));
  const { data: historyOthers } = historyOtherIds.length
    ? await supabaseAdmin.from('users').select('id, name').in('id', historyOtherIds)
    : { data: [] as any[] };
  const historyNameById = new Map((historyOthers ?? []).map((u: any) => [u.id, u.name]));

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <nav className={styles.nav}>
          <Wordmark size={1.15} href="/hub" />
          <div className={styles.navLinks}>
            <a href="/profile" className={styles.navLink}>Profile</a>
            <a href="/profile/preview" className={styles.navLink}>Preview</a>
            <a href="/dashboard" className={`${styles.navLink} ${styles.navLinkActive}`}>Matches</a>
            <a href="/quiz?retake=1" className={styles.navLink}>Retake quiz</a>
          </div>
        </nav>

        <DashboardExtras />

        <h1 className={styles.title}>
          your <span className={styles.titleAccent}>matches.</span>
        </h1>
        <p className={styles.subtitle}>
          one match at a time · the algorithm sets the pace →
        </p>

        {currentMatch && otherUser && !currentMatch.ended_at && (
          <MatchReveal
            matchId={currentMatch.id}
            name={otherUser.name || 'your match'}
            score={currentMatch.compatibility_score ?? null}
            archetype={otherUser.archetype}
          />
        )}

        {currentMatch && otherUser ? (
          <MatchCard
            match={currentMatch}
            otherUser={otherUser}
            currentUserId={user.id}
            isUnlocked={isUnlocked}
            hexacoUnlocked={hexacoUnlocked}
            profileUnlocked={profileUnlocked}
            distanceMi={(() => { const d = zipDistanceMiles(user.zip, otherUser.zip); return d == null ? null : Math.round(d); })()}
            beyondRadius={(() => {
              const d = zipDistanceMiles(user.zip, otherUser.zip);
              return d != null && d > (user.match_radius ?? DEFAULT_MATCH_RADIUS);
            })()}
          />
        ) : (
          <RosterPicker radius={user.match_radius ?? DEFAULT_MATCH_RADIUS} maxRadius={MAX_MATCH_RADIUS} refreshCount={user.profile_refresh_count ?? 0} />
        )}

        {historyMatches && historyMatches.length > 0 && (
          <div className={styles.history}>
            <h2 className={styles.historyTitle}>past matches</h2>
            <div className={styles.historyList}>
              {historyMatches.map((m: any) => {
                const otherId = m.user_1_id === user.id ? m.user_2_id : m.user_1_id;
                const name = historyNameById.get(otherId) || 'a match';
                return (
                  <div key={m.id} className={styles.historyItem}>
                    <span className={styles.historyDate}>
                      {new Date(m.ended_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className={styles.historyOutcome}>{name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <CorpFooter />
    </div>
  );
}
