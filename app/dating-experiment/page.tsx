import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { RAFFLE, raffleEligible } from '@/lib/raffle';
import DatingExperimentClient from '@/app/raffle/raffle-client';
import { experimentGendersFromLegacy } from '@/lib/experiment-preferences';
import {
  datingExperimentAdminRehearsalOpen,
  datingExperimentDateLabel,
  datingExperimentEntriesOpen,
  getDatingExperimentEvent,
} from '@/lib/dating-experiment-event';

export const dynamic = 'force-dynamic';

function PublicExperimentLanding({ experiment }: { experiment: Awaited<ReturnType<typeof getDatingExperimentEvent>> }) {
  const entriesOpen = datingExperimentEntriesOpen(experiment);
  const name = experiment?.public_name ?? RAFFLE.series;
  const budget = (experiment?.prize_per_pair_cents ?? RAFFLE.budget * 100) / 100;
  const pairCount = experiment?.winner_pair_limit ?? RAFFLE.winnerPairCount;
  const entryCap = experiment?.entry_cap ?? RAFFLE.cap;
  const dateLabel = datingExperimentDateLabel(experiment);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--h-bg)', color: 'var(--h-text)', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <main style={{
        width: '100%',
        maxWidth: 760,
        margin: '0 auto',
        boxSizing: 'border-box',
        padding: 'calc(1.4rem + env(safe-area-inset-top, 0px)) calc(1.15rem + env(safe-area-inset-right, 0px)) calc(4rem + env(safe-area-inset-bottom, 0px)) calc(1.15rem + env(safe-area-inset-left, 0px))',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <Link href="/" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: 'italic', fontWeight: 700, fontSize: '1.25rem', textDecoration: 'none' }}>
            <span style={{ color: '#2563ff' }}>Not</span><span style={{ color: '#ff6a1f' }}>Cupid</span>
          </Link>
          <Link href="/login?next=/dating-experiment" style={{ color: 'var(--h-text-dim)', fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none' }}>log in →</Link>
        </div>

        <section style={{ marginTop: 'clamp(2.4rem, 8vw, 4.5rem)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.42rem 0.65rem', borderRadius: 999, background: entriesOpen ? 'rgba(45,122,79,0.1)' : 'var(--h-surface-2)', color: entriesOpen ? '#2d7a4f' : 'var(--h-text-dim)', fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.11em', textTransform: 'uppercase', fontWeight: 700 }}>
            <span aria-hidden>{entriesOpen ? '●' : '○'}</span> {entriesOpen ? 'entries open' : 'entries unavailable'}
          </div>
          <h1 style={{ margin: '0.75rem 0 0', fontFamily: "'Playfair Display', Georgia, serif", fontStyle: 'italic', fontSize: 'clamp(3rem, 13vw, 5.4rem)', lineHeight: 0.92, letterSpacing: '-0.045em' }}>
            the Dating<br /><span style={{ color: '#ff6a1f' }}>Experiment.</span>
          </h1>
          <p style={{ margin: '1.1rem 0 0', maxWidth: 610, color: 'var(--h-text-dim)', fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 'clamp(1.02rem, 4vw, 1.25rem)', lineHeight: 1.55 }}>
            {name}. Set your preferences, meet up to two compatibility-led options privately, and choose who you would actually meet. They choose privately too.
          </p>
        </section>

        <section aria-label="Experiment details" style={{ marginTop: '1.6rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.7rem' }}>
          {[
            ['the plan', `Up to ${pairCount} mutual Boston pairs`],
            ['the dinner', `Up to $${budget} per selected pair`],
            ['the date', dateLabel],
            ['the entry window', `${entryCap} spots · closes ${RAFFLE.entryCloseLabel}`],
          ].map(([label, value]) => (
            <div key={label} style={{ padding: '0.95rem', borderRadius: 14, border: '1px solid var(--h-border)', background: 'var(--h-surface)' }}>
              <div style={{ color: '#d2530f', fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
              <div style={{ marginTop: '0.35rem', color: 'var(--h-text)', fontSize: '0.88rem', lineHeight: 1.5 }}>{value}</div>
            </div>
          ))}
        </section>

        <div style={{ marginTop: '1.35rem', display: 'grid', gap: '0.65rem' }}>
          <Link href="/login?next=/dating-experiment" style={{ display: 'block', padding: '0.95rem 1rem', borderRadius: 14, background: entriesOpen ? '#ff6a1f' : 'var(--h-surface-2)', color: entriesOpen ? '#fff' : 'var(--h-text-dim)', textAlign: 'center', textDecoration: 'none', fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, pointerEvents: entriesOpen ? 'auto' : 'none' }}>
            {entriesOpen ? 'join free →' : 'entries are not open'}
          </Link>
          {entriesOpen && <Link href="/quiz?next=experiment" style={{ display: 'block', padding: '0.85rem 1rem', borderRadius: 14, border: '1px solid var(--h-border)', color: 'var(--h-text)', textAlign: 'center', textDecoration: 'none', fontSize: '0.84rem', fontWeight: 650 }}>new to NotCupid? build your profile →</Link>}
        </div>

        <p style={{ margin: '1rem 0 0', color: 'var(--h-text-faint)', fontSize: '0.74rem', lineHeight: 1.55 }}>
          Free entry. Massachusetts residents age 21+ within {experiment?.radius_miles ?? RAFFLE.radiusMiles} miles of ZIP {experiment?.center_zip ?? RAFFLE.centerZip}. A private hello video is optional. No match or dinner is guaranteed.
        </p>
        <div style={{ marginTop: '1.15rem', display: 'flex', flexWrap: 'wrap', gap: '0.6rem 1rem', fontSize: '0.8rem' }}>
          <Link href="/dating-experiment/faq" style={{ color: '#d2530f', fontWeight: 700 }}>how it works + FAQ</Link>
          <Link href="/dating-experiment/terms" style={{ color: 'var(--h-text-dim)' }}>Official Rules</Link>
          <Link href="/safety" style={{ color: 'var(--h-text-dim)' }}>safety</Link>
        </div>
      </main>
    </div>
  );
}

export default async function DatingExperimentPage() {
  const [user, experiment] = await Promise.all([getCurrentUser(), getDatingExperimentEvent()]);
  if (!user) return <PublicExperimentLanding experiment={experiment} />;
  const rehearsal = datingExperimentAdminRehearsalOpen(experiment, user);
  const eventLocation = experiment
    ? { centerZip: experiment.center_zip, radiusMiles: Number(experiment.radius_miles) }
    : RAFFLE;

  const interests = (user.hobbies?.length || 0) + (user.music?.length || 0) + (user.food?.length || 0) + (user.sports?.length || 0);
  const profile = {
    photo: !!user.photo_url,
    quiz: !!user.archetype && typeof user.score_honesty === 'number',
    bio: !!(user.bio || '').trim(),
    gender: user.gender || '',
    seekingGenders: experimentGendersFromLegacy(user.seeking),
    age: user.age ?? null,
    ageMin: user.age_min ?? 22,
    ageMax: user.age_max ?? 38,
    interests,
    archetype: user.archetype || null,
  };

  return (
    <DatingExperimentClient
      firstName={(user.name || 'friend').split(' ')[0]}
      eligible={user.is_test !== true && raffleEligible(user, eventLocation)}
      profile={profile}
      event={{
        series: experiment?.public_name ?? RAFFLE.series,
        city: experiment?.city ?? RAFFLE.city,
        dateLabel: datingExperimentDateLabel(experiment),
        dateOptions: experiment?.dinner_dates.map((slot) => ({
          key: slot.slot_key,
          label: slot.public_label,
          eventDate: slot.event_date,
          dateLabel: new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${slot.event_date}T12:00:00Z`)),
          timeLabel: slot.public_label.includes(' · ') ? slot.public_label.split(' · ').slice(1).join(' · ') : slot.public_label,
        })) ?? RAFFLE.dateOptions,
        budget: (experiment?.prize_per_pair_cents ?? RAFFLE.budget * 100) / 100,
        tagline: RAFFLE.tagline,
        drawLabel: RAFFLE.drawLabel,
        radiusMiles: Number(experiment?.radius_miles ?? RAFFLE.radiusMiles),
        centerZip: experiment?.center_zip ?? RAFFLE.centerZip,
        termsVersion: experiment?.terms_version ?? RAFFLE.termsVersion,
        videoMinSeconds: RAFFLE.videoMinSeconds,
        videoMaxSeconds: RAFFLE.videoMaxSeconds,
        videoMaxBytes: RAFFLE.videoMaxBytes,
        shortlistMaxOptions: experiment?.shortlist_max_options ?? RAFFLE.shortlistMaxOptions,
        winnerPairCount: experiment?.winner_pair_limit ?? RAFFLE.winnerPairCount,
        entriesOpen: datingExperimentEntriesOpen(experiment) || rehearsal,
        rehearsal,
        statusLabel: RAFFLE.statusLabel,
      }}
    />
  );
}
