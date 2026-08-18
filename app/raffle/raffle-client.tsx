'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { subscribeToPush } from '@/lib/push-client';
import { datingExperimentGateIssues } from '@/lib/dating-experiment-gate';
import { EXPERIMENT_ORIENTATION_OPTIONS } from '@/lib/experiment-preferences';
import { readStoredAcquisition } from '@/lib/acquisition';

type Event = {
  series: string;
  city: string;
  dateLabel: string;
  budget: number;
  tagline: string;
  drawLabel: string;
  radiusMiles: number;
  centerZip: string;
  termsVersion: string;
  videoMinSeconds: number;
  videoMaxSeconds: number;
  videoMaxBytes: number;
  shortlistMaxOptions?: number;
  winnerPairCount?: number;
  entriesOpen?: boolean;
  rehearsal?: boolean;
  statusLabel?: string;
  dateOptions?: { key: string; label: string; eventDate?: string; dateLabel?: string; timeLabel?: string }[];
};
type Profile = { photo: boolean; quiz: boolean; bio: boolean; gender: string; seekingGenders: string[]; age: number | null; ageMin: number; ageMax: number; interests: number; archetype: string | null };

const ORANGE = '#ff6a1f';
const ORANGE_DEEP = '#d2530f';
const BLUE = '#2563ff';
const GREEN = '#2d7a4f';
const GENDERS = [['m', 'a man'], ['f', 'a woman'], ['nb', 'non-binary / another identity']];
const SEEKING_GENDERS = [['f', 'women'], ['m', 'men'], ['nb', 'non-binary / another identity']];

function trackExperimentFunnel(event: string, metadata?: Record<string, unknown>) {
  return fetch('/api/campaign/dating-experiment-funnel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, metadata }),
    keepalive: true,
  }).catch(() => null);
}

// The public Dating Experiment flow. Legacy route/API names stay internal.
export default function RaffleClient({ firstName, eligible, profile, event }: {
  firstName: string; eligible: boolean; profile: Profile; event: Event;
}) {
  const [gender, setGender] = useState(profile.gender);
  const [orientation, setOrientation] = useState('');
  const [seekingGenders, setSeekingGenders] = useState<string[]>(profile.seekingGenders);
  const [ageMin, setAgeMin] = useState(profile.ageMin);
  const [ageMax, setAgeMax] = useState(profile.ageMax);
  const [availableSlotKeys, setAvailableSlotKeys] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [notify, setNotify] = useState(true);
  const [intention, setIntention] = useState('');
  const [energy, setEnergy] = useState('');
  const [planningStyle, setPlanningStyle] = useState('');
  const [conversationStarter, setConversationStarter] = useState('');
  const [attendanceConfirmed, setAttendanceConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [previewConsent, setPreviewConsent] = useState(false);
  const [safetyAcknowledged, setSafetyAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const [rulesSeen, setRulesSeen] = useState(false);
  const [rulesReady, setRulesReady] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Live experiment state (entered / selected / accepted / it's-a-date).
  const [st, setSt] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [pushOn, setPushOn] = useState(true);

  useEffect(() => {
    let active = true;
    const refreshStatus = () => fetch('/api/raffle/status', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (active && d) setSt(d); })
      .catch(() => null)
      .finally(() => { if (active) setLoaded(true); });
    refreshStatus();
    // Mobile browsers commonly restore this page from their back/forward cache
    // after a profile fix. Re-check the server so a completed profile does not
    // remain visibly blocked by the old page snapshot.
    const refreshVisible = () => { if (document.visibilityState === 'visible') refreshStatus(); };
    window.addEventListener('pageshow', refreshStatus);
    document.addEventListener('visibilitychange', refreshVisible);
    trackExperimentFunnel('experiment_viewed');
    if (typeof Notification !== 'undefined') setPushOn(Notification.permission === 'granted');
    return () => {
      active = false;
      window.removeEventListener('pageshow', refreshStatus);
      document.removeEventListener('visibilitychange', refreshVisible);
    };
  }, []);

  const ev = { ...event, ...(st?.event || {}) } as any;
  const other = st?.other?.name ? st.other.name.split(' ')[0] : 'your match';
  const assignedDinner = st?.draw?.happensAt
    ? new Intl.DateTimeFormat('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short',
    }).format(new Date(st.draw.happensAt))
    : ev.dateLabel;
  const availabilityGroups = ((ev.dateOptions || []) as NonNullable<Event['dateOptions']>).reduce((groups, slot) => {
    const groupKey = slot.eventDate || slot.dateLabel || slot.label;
    const current = groups.find((group) => group.key === groupKey);
    if (current) current.slots.push(slot);
    else groups.push({ key: groupKey, label: slot.dateLabel || slot.label, slots: [slot] });
    return groups;
  }, [] as { key: string; label: string; slots: NonNullable<Event['dateOptions']> }[]);

  useEffect(() => {
    const key = `notcupid-dating-experiment-rules:${ev.termsVersion}`;
    try { setRulesSeen(window.localStorage.getItem(key) === 'reviewed'); }
    catch { setRulesSeen(false); }
    setRulesReady(true);
  }, [ev.termsVersion]);

  function continueFromRules() {
    const key = `notcupid-dating-experiment-rules:${ev.termsVersion}`;
    try { window.localStorage.setItem(key, 'reviewed'); } catch { /* the legal consent remains in the form */ }
    setRulesSeen(true);
    trackExperimentFunnel('rules_continued');
  }

  const serverRequirements = new Map<string, boolean>(
    (Array.isArray(st?.profileGate?.requirements) ? st.profileGate.requirements : [])
      .map((item: any) => [String(item.key), item.ready === true]),
  );
  const profileState = {
    photo: serverRequirements.get('photo') ?? profile.photo,
    quiz: serverRequirements.get('quiz') ?? profile.quiz,
    bio: serverRequirements.get('bio') ?? profile.bio,
    interests: typeof st?.profileGate?.interests === 'number' ? st.profileGate.interests : profile.interests,
    age: typeof st?.profileGate?.age === 'number' ? st.profileGate.age : profile.age,
  };

  // "Established cred" from the real profile — entry isn't one click.
  const cred = [
    { key: 'photo', ok: profileState.photo, label: 'a profile photo', fix: '/dating-experiment/profile?from=experiment' },
    { key: 'quiz', ok: profileState.quiz, label: 'the personality quiz', fix: '/quiz?next=experiment' },
    { key: 'bio', ok: profileState.bio, label: 'a bio (a few words about you)', fix: '/dating-experiment/profile?from=experiment' },
    { key: 'interests', ok: profileState.interests >= 3, label: '3+ interests (music, food, hobbies, sports)', fix: '/dating-experiment/profile?from=experiment' },
    { key: 'age', ok: profileState.age != null && profileState.age >= 21, label: profileState.age != null && profileState.age < 21 ? 'be 21+ — this dinner is 21 and over' : 'your age (21+ for this dinner)', fix: profileState.age == null ? '/dating-experiment/profile?from=experiment' : undefined },
  ];
  const preferencesOk = !!gender && !!orientation && seekingGenders.length > 0
    && Number.isInteger(ageMin) && Number.isInteger(ageMax)
    && ageMin >= 21 && ageMin <= 99 && ageMax >= ageMin && ageMax <= 99;
  const scheduleOk = availableSlotKeys.length > 0;
  const questionsOk = !!intention && !!energy && !!planningStyle && conversationStarter.trim().length >= 3;
  const consentOk = attendanceConfirmed && termsAccepted && previewConsent && safetyAcknowledged;
  const gateIssues = datingExperimentGateIssues({
    photo: profileState.photo,
    quiz: profileState.quiz,
    bio: profileState.bio,
    interests: profileState.interests,
    age: profileState.age,
    gender,
    orientation,
    seekingGenders,
    ageMin,
    ageMax,
    availableSlotKeys,
    intention,
    energy,
    planningStyle,
    conversationStarter,
    attendanceConfirmed,
    termsAccepted,
    previewConsent,
    safetyAcknowledged,
  });
  const canEnter = gateIssues.length === 0;
  const showRulesGate = ev.entriesOpen && !ev.closed && eligible && loaded && rulesReady && !rulesSeen
    && !(done || st?.entered || st?.draw || st?.shortlist?.length);

  useEffect(() => {
    if (preferencesOk) trackExperimentFunnel('preferences_completed');
  }, [preferencesOk]);
  useEffect(() => {
    if (scheduleOk) trackExperimentFunnel('schedule_selected');
  }, [scheduleOk]);
  useEffect(() => {
    if (questionsOk) trackExperimentFunnel('questionnaire_completed');
  }, [questionsOk]);
  useEffect(() => {
    if (consentOk) trackExperimentFunnel('consent_completed');
  }, [consentOk]);

  function toggleSeekingGender(value: string) {
    setSeekingGenders((current) => current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]);
  }

  function toggleAvailableSlot(value: string) {
    setAvailableSlotKeys((current) => current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]);
  }

  async function onVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > ev.videoMaxBytes) { setErr('that video is over 25MB — keep it to a quick hello.'); return; }
    setUploading(true); setErr('');
    try {
      const duration = await readVideoDuration(file);
      if (duration < ev.videoMinSeconds || duration > ev.videoMaxSeconds) {
        setErr(`keep the intro between ${ev.videoMinSeconds} and ${ev.videoMaxSeconds} seconds — aim for about 10.`);
        return;
      }
      const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
      const r = await fetch('/api/raffle/upload-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ext }) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'upload not available — try again shortly.'); return; }
      const put = await fetch(d.signedUrl, { method: 'PUT', body: file, headers: { 'content-type': d.contentType } });
      if (!put.ok) { setErr('upload failed — try again.'); return; }
      setVideoUrl(d.storageRef || d.publicUrl);
      setVideoDuration(duration);
    } catch { setErr('upload failed — try again.'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  async function removeVideo() {
    if (!videoUrl || uploading) return;
    setUploading(true); setErr('');
    try {
      const r = await fetch('/api/raffle/upload-url', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_url: videoUrl }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error || 'could not remove that video'); return; }
      setVideoUrl(null);
      setVideoDuration(null);
    } catch { setErr('could not remove that video — try again'); }
    finally { setUploading(false); }
  }

  function focusGateIssue(targetId: string) {
    const target = document.getElementById(targetId);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const focusable = target.matches('a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])')
      ? target
      : target.querySelector<HTMLElement>('a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])');
    window.setTimeout(() => focusable?.focus({ preventScroll: true }), 350);
  }

  function guideToMissingRequirements() {
    const first = gateIssues[0];
    if (!first) return;
    focusGateIssue(first.targetId);
  }

  async function enter() {
    if (!canEnter) { guideToMissingRequirements(); return; }
    setBusy(true); setErr('');
    trackExperimentFunnel('entry_submit_attempted');
    try {
      if (notify) await subscribeToPush().catch(() => {});
      const r = await fetch('/api/raffle/enter', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_url: videoUrl,
          videoDurationSeconds: videoDuration,
          notify,
          gender,
          orientation,
          seekingGenders,
          ageMin,
          ageMax,
          availableSlotKeys,
          intention,
          energy,
          planningStyle,
          conversationStarter: conversationStarter.trim(),
          attendanceConfirmed,
          termsAccepted,
          termsVersion: ev.termsVersion,
          previewConsent,
          safetyAcknowledged,
          acquisition: readStoredAcquisition(),
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        const reason = d.error || 'could not enter';
        setErr(reason);
        trackExperimentFunnel('entry_submit_failed', { status: r.status, reason });
        return;
      }
      setDone(true);
    } catch {
      const reason = 'could not enter — try again';
      setErr(reason);
      trackExperimentFunnel('entry_submit_failed', { status: 0, reason: 'network-or-client-error' });
    }
    finally { setBusy(false); }
  }

  async function respond(accept: boolean) {
    setBusy(true); setErr('');
    const r = await fetch('/api/raffle/respond', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accept }) });
    if (r.ok) window.location.reload(); else { setBusy(false); setErr('try again'); }
  }
  async function withdraw() {
    if (!window.confirm('Withdraw from this Dating Experiment round? Any optional experiment video will also be deleted.')) return;
    setBusy(true); setErr('');
    const r = await fetch('/api/raffle/withdraw', { method: 'POST' });
    if (r.ok) window.location.reload();
    else { const d = await r.json().catch(() => ({})); setErr(d.error || 'could not withdraw'); setBusy(false); }
  }
  async function enablePush() { const ok = await subscribeToPush(); setPushOn(ok); if (!ok) setErr('couldn’t enable — on iPhone, install the app first'); }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--h-bg)', color: 'var(--h-text)', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      {showRulesGate && (
        <div role="presentation" style={rulesBackdrop}>
          <section role="dialog" aria-modal="true" aria-labelledby="experiment-rules-title" style={rulesModal}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: ORANGE_DEEP, fontWeight: 700 }}>before you join · 2 minutes</div>
            <h2 id="experiment-rules-title" style={{ ...cardH, fontSize: 'clamp(1.8rem,8vw,2.45rem)', marginTop: '0.45rem' }}>the rules, without the legal fog.</h2>
            <p style={{ ...cardP, fontSize: '0.94rem' }}>This is a free, compatibility-led Dating Experiment—not a blind date and not a paid-entry raffle.</p>
            <div style={{ display: 'grid', gap: '0.65rem', marginTop: '1rem' }}>
              <RuleLine icon="📍" title="Boston + 21 only" body={`You must live in Massachusetts within ${ev.radiusMiles} miles of ${ev.centerZip}.`} />
              <RuleLine icon="📸" title="A real profile" body="Add a clear profile photo, your quiz, a short bio, and at least three interests." />
              <RuleLine icon="🎬" title="A private hello — if you want" body={`An original ${ev.videoMinSeconds}–${ev.videoMaxSeconds}-second intro is optional. It never changes your eligibility, fit score, or selection odds, and only your private shortlist and limited operators can view it.`} />
              <RuleLine icon="✦" title="You both choose" body={`You may see up to ${ev.shortlistMaxOptions || 2} reciprocal options. Your yes/pass stays sealed; only mutual yes pairs can be selected.`} />
              <RuleLine icon="🍽️" title="Two dinners on August 20" body={`${(ev.dateOptions || []).map((slot: any) => slot.label).join(' or ')}. One pair per slot, up to $${ev.budget} per pair. Restaurant details come privately later.`} />
              <RuleLine icon="🛡️" title="Keep it safe" body="The dinner is in public, but NotCupid does not run criminal background checks or guarantee identity, behavior, chemistry, or attendance." />
            </div>
            <p style={{ margin: '0.9rem 0 0', fontSize: '0.72rem', lineHeight: 1.5, color: 'var(--h-text-faint)' }}>No purchase necessary. Four people maximum across two winning pairs. Payment and Pro status never affect selection. Reviewing this summary is not entry or legal consent—you will confirm each required notice separately in the form.</p>
            <div style={{ display: 'grid', gap: '0.55rem', marginTop: '1rem' }}>
              <button type="button" onClick={continueFromRules} style={{ border: 'none', borderRadius: 14, padding: '0.85rem 1rem', background: ORANGE, color: '#fff', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.45rem', letterSpacing: '0.04em', cursor: 'pointer' }}>I understand — continue →</button>
              <Link href="/dating-experiment/terms" target="_blank" style={{ ...btnGhost, textAlign: 'center' }}>read the full Official Rules ↗</Link>
              <Link href="/hub" style={{ textAlign: 'center', color: 'var(--h-text-faint)', fontSize: '0.72rem' }}>not now — back to hub</Link>
            </div>
          </section>
        </div>
      )}
      <div style={{
        maxWidth: 560,
        margin: '0 auto',
        padding: 'calc(1.5rem + env(safe-area-inset-top, 0px)) calc(1.25rem + env(safe-area-inset-right, 0px)) calc(4rem + env(safe-area-inset-bottom, 0px)) calc(1.25rem + env(safe-area-inset-left, 0px))',
      }}>
        <Link href="/hub" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--h-text-dim)', textDecoration: 'none' }}>← hub</Link>

        {ev.rehearsal && (
          <div role="status" style={{ marginTop: '1rem', padding: '0.75rem 0.9rem', border: '1px solid rgba(37,99,255,0.35)', borderRadius: 12, background: 'rgba(37,99,255,0.08)', color: 'var(--h-text-dim)', fontSize: '0.78rem', lineHeight: 1.45 }}>
            <b style={{ color: 'var(--h-text)' }}>Private admin rehearsal.</b> You can test the real form, optional video upload, submission, persistence, and withdrawal. Public entries are still closed.
          </div>
        )}

        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.24em', textTransform: 'uppercase', color: ORANGE_DEEP, margin: '1.5rem 0 0.6rem', fontWeight: 700 }}>🎟️ {ev.series} · {ev.city}</div>
        <h1 style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: 'clamp(2.2rem,8vw,3.2rem)', lineHeight: 1.02, margin: '0 0 0.6rem' }}>{ev.tagline}</h1>
        <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: 'var(--h-text-dim)', fontSize: '1.05rem', margin: '0 0 1.75rem' }}>
          up to two compatibility-led options, private mutual choices, and up to {ev.winnerPairCount || 2} dinner pairs covered to <b>${ev.budget} each*</b>. <b>{ev.dateLabel}</b>.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem', margin: '-0.85rem 0 1.25rem' }}>
          <Link href="/dating-experiment/faq" style={infoLink}>how it works + FAQ</Link>
          <Link href="/dating-experiment/terms" style={infoLink}>experiment terms</Link>
          <Link href="/safety" style={infoLink}>safety</Link>
        </div>
        <div style={{ ...card, marginBottom: '1.1rem', padding: '0.9rem 1rem', background: 'rgba(37,99,255,0.05)', borderColor: 'rgba(37,99,255,0.22)' }}>
          <p style={{ ...cardP, margin: 0, fontSize: '0.82rem' }}><b>Your profile comes with you.</b> We reuse your existing profile, quiz, photos, interests, and compatibility signals. Your optional experiment video, four quick answers, preferences, consent, and shortlist choices stay separate for this round and never change your regular Love Line.</p>
        </div>

        {!ev.entriesOpen && !(st?.entered || st?.draw || st?.outcome) ? (
          <div style={card}>
            <h2 style={cardH}>entries aren’t open right now.</h2>
            <p style={cardP}>the live experiment status can pause entry at the deadline, at capacity, or if an operating check needs attention.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem' }}>
              <Link href="/dating-experiment/faq" style={backLink}>see the simple plan →</Link>
              <Link href="/hub" style={backLink}>back to hub →</Link>
            </div>
          </div>
        ) : !eligible && !st?.outcome ? (
          <div style={card}>
            <h2 style={cardH}>this one’s local to Boston.</h2>
            <p style={cardP}>you need to be a Massachusetts resident within {ev.radiusMiles} miles of {ev.centerZip} and able to attend the stated dinner. update your location on the <Link href="/dashboard" style={{ color: ORANGE_DEEP }}>Love Line</Link> if that’s you.</p>
          </div>
        ) : !loaded ? (
          <div style={{ ...card, textAlign: 'center', color: 'var(--h-text-faint)', fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', letterSpacing: '0.1em' }}>loading your entry…</div>
        ) : st?.draw?.bothAccepted ? (
          // ── it's a date ──
          <div style={{ ...card, border: `2px solid ${GREEN}`, textAlign: 'center' }}>
            <div style={{ fontSize: '2.2rem' }}>✦</div>
            <h2 style={cardH}>it’s a date with {other}.</h2>
            <p style={cardP}>you chose each other. Your <b>${ev.budget} dinner</b> is confirmed for <b>{assignedDinner}</b>. {st.draw.restaurant}</p>
            <p style={{ fontSize: '0.76rem', color: 'var(--h-text-faint)', lineHeight: 1.5, margin: '0.85rem 0 0' }}>
              💛 meet in public, tell a friend where you’ll be, and arrange your own ride home. Parking, valet costs or tips, and transportation are not included. trust your gut.
            </p>
            <Link href="/hub" style={backLink}>back to hub →</Link>
          </div>
        ) : st?.outcome?.state === 'not-selected' ? (
          <div style={{ ...card, border: '1px solid rgba(37,99,255,0.28)', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem' }}>✦</div>
            <h2 style={cardH}>your experiment entry is complete.</h2>
            <p style={cardP}>A dinner pair wasn’t confirmed for you this time. Your yes, pass, and favorite choices remain private—we never reveal whether another person passed or did not respond.</p>
            <p style={{ ...cardP, fontSize: '0.8rem', marginTop: '0.65rem' }}>This result does not change your regular Love Line profile or matches.</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.9rem' }}>
              <Link href="/dashboard" style={backLink}>open Love Line →</Link>
              <Link href="/hub" style={backLink}>back to hub →</Link>
            </div>
          </div>
        ) : st?.outcome?.state === 'withdrawn' ? (
          <div style={{ ...card, textAlign: 'center' }}>
            <h2 style={cardH}>your entry was withdrawn.</h2>
            <p style={cardP}>You’re no longer in this experiment. Your regular NotCupid profile and Love Line are unchanged.</p>
            <Link href="/hub" style={backLink}>back to hub →</Link>
          </div>
        ) : st?.shortlist?.length ? (
          <ShortlistPanel
            offers={st.shortlist}
            round={st.shortlistRound}
            budget={ev.budget}
            busy={busy}
            setBusy={setBusy}
            setErr={setErr}
          />
        ) : (st?.draw && st.draw.status === 'pending' && !st.draw.myAccepted) ? (
          // ── you've been drawn → accept / reject ──
          <div style={{ ...card, border: `2px solid ${BLUE}`, textAlign: 'center' }}>
            <div style={{ fontSize: '2.2rem' }}>🎉</div>
            <h2 style={cardH}>you’ve been selected — meet {other}.</h2>
            <p style={cardP}>you two scored <b>{st.draw.score}% compatible</b>. Preview each other privately, then decide. Both yes locks in the <b>${ev.budget} dinner</b> on <b>{ev.dateLabel}</b>.{st.draw.theyAccepted ? ` ${other} already said yes 👀` : ''}</p>
            {st.other && (
              <div style={{ marginTop: '1rem', padding: '0.85rem', borderRadius: 14, background: 'var(--h-surface-2)', textAlign: 'left' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '0.45rem' }}>
                  {[st.other.photo_url, ...(st.other.gallery || [])].filter(Boolean).slice(0, 4).map((src: string, i: number) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={`${src}-${i}`} src={src} alt={`${other} profile ${i + 1}`} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 10 }} />
                  ))}
                </div>
                {st.other.introVideoPreviewUrl && (
                  <video src={st.other.introVideoPreviewUrl} controls playsInline preload="metadata" style={{ width: '100%', display: 'block', marginTop: '0.65rem', borderRadius: 10, background: '#000' }} />
                )}
                {st.other.orientation && <p style={{ margin: '0.65rem 0 0', fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', color: BLUE, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{st.other.orientation}</p>}
                {st.other.conversationStarter && <p style={{ margin: '0.7rem 0 0', fontSize: '0.84rem', lineHeight: 1.45, color: 'var(--h-text-dim)' }}><b style={{ color: 'var(--h-text)' }}>ask {other} about:</b> {st.other.conversationStarter}</p>}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', marginTop: '1rem' }}>
              <button onClick={() => respond(true)} disabled={busy} style={{ background: BLUE, color: '#fff', border: 'none', borderRadius: 999, padding: '0.7rem 1.9rem', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.35rem', letterSpacing: '0.04em', cursor: busy ? 'wait' : 'pointer' }}>{busy ? '…' : 'accept →'}</button>
              <button onClick={() => respond(false)} disabled={busy} style={{ background: 'none', color: 'var(--h-text-dim)', border: '1px solid var(--h-border)', borderRadius: 999, padding: '0.7rem 1.5rem', fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>pass privately</button>
            </div>
          </div>
        ) : (st?.draw?.myAccepted && !st.draw.bothAccepted) ? (
          // ── you accepted, waiting on them ──
          <div style={{ ...card, border: `2px solid ${BLUE}`, textAlign: 'center' }}>
            <h2 style={cardH}>you’re in — waiting on {other}.</h2>
            <p style={cardP}>you said yes to your <b>${ev.budget} date</b>. as soon as {other} accepts, it’s locked for {ev.dateLabel}.</p>
            <Link href="/hub" style={backLink}>back to hub →</Link>
          </div>
        ) : (done || st?.entered) ? (
          // ── entered, not yet drawn ──
          <div style={{ background: 'linear-gradient(135deg, rgba(255,106,31,0.12), var(--h-surface))', border: `2px solid ${ORANGE}`, borderRadius: 18, padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.2rem' }}>🎉</div>
            <h2 style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '1.6rem', margin: '0.3rem 0' }}>you’re in{done ? `, ${firstName.toLowerCase()}` : ''}.</h2>
            <p style={{ color: 'var(--h-text-dim)', fontSize: '0.92rem', margin: '0 0 1rem' }}>shortlists form <b>{ev.drawLabel}</b>. We’ll ping you if you receive one or two private options. good luck ✦</p>
            {!pushOn && <button onClick={enablePush} style={{ display: 'block', margin: '0 auto 0.9rem', background: 'var(--h-surface-2)', border: '1px solid rgba(255,106,31,0.4)', color: ORANGE_DEEP, borderRadius: 999, padding: '0.5rem 1.1rem', fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}>🔔 turn on experiment notifications</button>}
            <Link href="/hub" style={{ display: 'inline-block', background: ORANGE, color: '#fff', borderRadius: 999, padding: '0.6rem 1.5rem', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', textDecoration: 'none' }}>back to hub →</Link>
            <button onClick={withdraw} disabled={busy} style={{ display: 'block', margin: '0.9rem auto 0', border: 'none', background: 'none', color: 'var(--h-text-faint)', textDecoration: 'underline', cursor: busy ? 'wait' : 'pointer', fontSize: '0.72rem' }}>withdraw my entry</button>
          </div>
        ) : ev.closed ? (
          // ── entries closed ──
          <div style={card}>
            <h2 style={cardH}>entries are closed.</h2>
            <p style={cardP}>the entry window ended or this round reached its cap — watch the hub for the next one.</p>
          </div>
        ) : !rulesReady || !rulesSeen ? (
          <div style={{ ...card, textAlign: 'center' }}>
            <h2 style={cardH}>review the experiment rules first.</h2>
            <p style={cardP}>The short rules card explains the two dinner slots, optional private video, mutual choice, eligibility, and safety before the entry form opens.</p>
          </div>
        ) : (
          // ── register ──
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            {/* ① cred check — pulled from the profile */}
            <div style={card}>
              <div style={cardLabel}>① your cred</div>
              <p style={cardP}>we match on who you actually are, so your profile has to be real first.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.7rem' }}>
                {cred.map((c) => (
                  <div id={`experiment-cred-${c.key}`} key={c.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: c.ok ? 'var(--h-text)' : 'var(--h-text-dim)', scrollMarginTop: '6rem' }}>
                    <span style={{ color: c.ok ? GREEN : ORANGE_DEEP, fontWeight: 700 }}>{c.ok ? '✓' : '○'}</span>
                    <span style={{ flex: 1 }}>{c.label}</span>
                    {!c.ok && c.fix && <Link href={c.fix} style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: ORANGE_DEEP, textDecoration: 'none' }}>fix →</Link>}
                  </div>
                ))}
              </div>
            </div>

            {/* ② match basics — the questions */}
            <div style={card}>
              <div style={cardLabel}>② your match basics</div>
              <p style={cardP}>so the system only considers people you’d actually want across the table.</p>
              <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                <div id="experiment-gender" style={{ scrollMarginTop: '6rem' }}>
                  <div style={qLabel}>I’m…</div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {GENDERS.map(([v, l]) => <button key={v} type="button" aria-pressed={gender === v} onClick={() => setGender(v)} style={chip(gender === v)}>{l}</button>)}
                  </div>
                </div>
                <div id="experiment-orientation" style={{ scrollMarginTop: '6rem' }}>
                  <div style={qLabel}>my orientation… <span style={{ textTransform: 'none', letterSpacing: 0 }}>(choose one)</span></div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {EXPERIMENT_ORIENTATION_OPTIONS.map((option) => (
                      <button key={option.value} type="button" aria-pressed={orientation === option.value} onClick={() => setOrientation(option.value)} style={chip(orientation === option.value)}>{option.label}</button>
                    ))}
                  </div>
                  <div style={{ marginTop: '0.35rem', color: 'var(--h-text-faint)', fontSize: '0.72rem', lineHeight: 1.4 }}>This describes you and is shown only to your private shortlist. The gender choices below—not an assumed label—control who can be considered.</div>
                </div>
                <div id="experiment-seeking" style={{ scrollMarginTop: '6rem' }}>
                  <div style={qLabel}>match me with… <span style={{ textTransform: 'none', letterSpacing: 0 }}>(choose one or more)</span></div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {SEEKING_GENDERS.map(([v, l]) => (
                      <button key={v} type="button" aria-pressed={seekingGenders.includes(v)} onClick={() => toggleSeekingGender(v)} style={chip(seekingGenders.includes(v))}>{l}</button>
                    ))}
                  </div>
                  <div style={{ marginTop: '0.35rem', color: 'var(--h-text-faint)', fontSize: '0.72rem', lineHeight: 1.4 }}>Only people whose own preferences include you can appear. These choices are saved for this experiment and won’t change your general Love Line settings.</div>
                </div>
                <div id="experiment-age-range" style={{ scrollMarginTop: '6rem' }}>
                  <div style={qLabel}>ages I’m open to</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input aria-label="minimum age" type="number" min={21} max={99} value={ageMin} onChange={(e) => setAgeMin(+e.target.value)} style={numIn} />
                    <span style={{ color: 'var(--h-text-faint)' }}>to</span>
                    <input aria-label="maximum age" type="number" min={21} max={99} value={ageMax} onChange={(e) => setAgeMax(+e.target.value)} style={numIn} />
                  </div>
                  <div style={{ marginTop: '0.35rem', color: 'var(--h-text-faint)', fontSize: '0.72rem', lineHeight: 1.4 }}>Age preferences must work both ways too—you must fall inside their selected range.</div>
                </div>
                <div id="experiment-schedule" style={{ scrollMarginTop: '6rem' }}>
                  <div style={qLabel}>date + time I can attend <span style={{ textTransform: 'none', letterSpacing: 0 }}>(choose every slot that works)</span></div>
                  <div style={{ display: 'grid', gap: '0.65rem' }}>
                    {availabilityGroups.map((group) => (
                      <fieldset key={group.key} style={{ margin: 0, padding: '0.65rem', border: '1px solid var(--h-border)', borderRadius: 12 }}>
                        <legend style={{ padding: '0 0.35rem', fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--h-text-dim)', fontWeight: 700 }}>{group.label}</legend>
                        <div style={{ display: 'grid', gap: '0.4rem' }}>
                          {group.slots.map((slot) => (
                            <button key={slot.key} type="button" aria-pressed={availableSlotKeys.includes(slot.key)} onClick={() => toggleAvailableSlot(slot.key)} style={{ ...chip(availableSlotKeys.includes(slot.key)), width: '100%', textAlign: 'left' }}>{availableSlotKeys.includes(slot.key) ? '✓ ' : ''}{slot.timeLabel || slot.label}</button>
                          ))}
                        </div>
                      </fieldset>
                    ))}
                  </div>
                  <div style={{ marginTop: '0.35rem', color: 'var(--h-text-faint)', fontSize: '0.72rem', lineHeight: 1.4 }}>Choose only slots you can commit to. We consider a pair only when both people selected the same date and time.</div>
                </div>
              </div>
            </div>

            {/* ③ short experiment questionnaire */}
            <div style={card}>
              <div style={cardLabel}>③ your experiment questionnaire</div>
              <p style={cardP}>your core personality, values, attachment, and lifestyle quiz stays the main signal. These four quick prompts tune this specific dinner.</p>
              <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div id="experiment-intention" style={{ scrollMarginTop: '6rem' }}>
                  <div style={qLabel}>what are you hoping for?</div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {[['relationship', 'a relationship'], ['intentional', 'intentional dating'], ['open', 'open, but real']].map(([v, l]) => <button key={v} type="button" aria-pressed={intention === v} onClick={() => setIntention(v)} style={chip(intention === v)}>{l}</button>)}
                  </div>
                </div>
                <div id="experiment-energy" style={{ scrollMarginTop: '6rem' }}>
                  <div style={qLabel}>your ideal dinner energy</div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {[['conversation', 'deep conversation'], ['playful', 'playful + easy'], ['foodie', 'food-first adventure']].map(([v, l]) => <button key={v} type="button" aria-pressed={energy === v} onClick={() => setEnergy(v)} style={chip(energy === v)}>{l}</button>)}
                  </div>
                </div>
                <div id="experiment-planning" style={{ scrollMarginTop: '6rem' }}>
                  <div style={qLabel}>how I like plans to happen</div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {[['planned', 'clear plan'], ['spontaneous', 'go with the flow'], ['flexible', 'either works']].map(([v, l]) => <button key={v} type="button" aria-pressed={planningStyle === v} onClick={() => setPlanningStyle(v)} style={chip(planningStyle === v)}>{l}</button>)}
                  </div>
                </div>
                <div id="experiment-conversation" style={{ scrollMarginTop: '6rem' }}>
                  <div style={qLabel}>a good thing to ask you about</div>
                  <input
                    value={conversationStarter}
                    maxLength={160}
                    onChange={(e) => setConversationStarter(e.target.value)}
                    placeholder="the niche thing you could talk about all night"
                    style={{ width: '100%', boxSizing: 'border-box', background: 'var(--h-surface-2)', border: '1px solid var(--h-border)', borderRadius: 10, padding: '0.65rem 0.75rem', color: 'var(--h-text)', fontSize: '0.86rem' }}
                  />
                </div>
              </div>
              <div style={{ marginTop: '0.85rem', padding: '0.7rem 0.75rem', borderRadius: 11, background: 'rgba(37,99,255,0.06)', border: '1px solid rgba(37,99,255,0.18)', color: 'var(--h-text-dim)', fontSize: '0.73rem', lineHeight: 1.5 }}>
                <b style={{ color: 'var(--h-text)' }}>How the fit score works:</b> 75% core NotCupid compatibility, 15% shared interests, and 10% this questionnaire. Mutual gender, age, location, and date/time preferences are hard gates—not score boosts.
              </div>
            </div>

            {/* ④ optional intro video */}
            <div style={card}>
              <div style={cardLabel}>④ your intro video <span style={{ color: 'var(--h-text-faint)' }}>· optional</span></div>
              <p style={cardP}>Skip this if it is not your thing. If you add one, aim for about 10 seconds: “hi, I’m {firstName} — my ideal Boston date is…” Only a selected potential date can view it, and it never changes your fit score or odds.</p>
              {videoUrl ? (
                <div style={{ marginTop: '0.7rem', fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', color: GREEN, letterSpacing: '0.06em' }}>✓ {videoDuration?.toFixed(1)}s video added · <button type="button" onClick={removeVideo} disabled={uploading} style={{ background: 'none', border: 'none', color: ORANGE_DEEP, cursor: uploading ? 'wait' : 'pointer', textDecoration: 'underline' }}>{uploading ? 'removing…' : 'remove'}</button></div>
              ) : (
                <label style={{ ...btnGhost, display: 'inline-block', marginTop: '0.7rem', cursor: uploading ? 'wait' : 'pointer' }}>
                  {uploading ? 'uploading…' : '🎬 upload a video'}
                  <input ref={fileRef} type="file" accept="video/*" capture="user" onChange={onVideo} disabled={uploading} style={{ display: 'none' }} />
                </label>
              )}
            </div>

            {/* ⑤ notifications */}
            <div style={card}>
              <div style={cardLabel}>⑤ notifications</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', marginTop: '0.5rem' }}>
                <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} style={{ width: 18, height: 18, accentColor: ORANGE }} />
                <span style={{ fontSize: '0.9rem', color: 'var(--h-text)' }}>🔔 ping me if I’m selected</span>
              </label>
            </div>

            {/* ⑥ separate, auditable consents */}
            <div style={card}>
              <div style={cardLabel}>⑥ confirm before joining <span style={{ color: ORANGE_DEEP }}>· required</span></div>
              {[
                { id: 'experiment-attendance', checked: attendanceConfirmed, setter: setAttendanceConfirmed, label: `I’m 21+, live in Massachusetts within ${ev.radiusMiles} miles of ${ev.centerZip}, and can attend every dinner time I selected above.` },
                { id: 'experiment-terms', checked: termsAccepted, setter: setTermsAccepted, label: <>I agree to the <Link href="/dating-experiment/terms" target="_blank" style={{ color: ORANGE_DEEP, fontWeight: 700 }}>Dating Experiment Terms</Link>.</> },
                { id: 'experiment-preview', checked: previewConsent, setter: setPreviewConsent, label: `I consent to my profile, orientation, photos, answers, and any optional intro video I add being shown privately to up to ${ev.shortlistMaxOptions || 2} potential dates per shortlist round.` },
                { id: 'experiment-safety', checked: safetyAcknowledged, setter: setSafetyAcknowledged, label: 'I understand NotCupid does not conduct criminal background checks or guarantee another participant’s identity, behavior, or compatibility.' },
              ].map(({ id, checked, setter, label }) => (
                <label id={id} key={id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer', marginTop: '0.7rem', scrollMarginTop: '6rem' }}>
                  <input type="checkbox" checked={checked} onChange={(e) => setter(e.target.checked)} style={{ width: 18, height: 18, accentColor: ORANGE, marginTop: '0.15rem', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.82rem', color: 'var(--h-text)', lineHeight: 1.5 }}>{label}</span>
                </label>
              ))}
            </div>

            {!canEnter && (
              <div id="experiment-gate-summary" role="status" aria-live="polite" style={{ padding: '0.85rem 0.95rem', borderRadius: 14, border: '1px solid rgba(255,106,31,0.34)', background: 'rgba(255,106,31,0.07)' }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: ORANGE_DEEP, fontWeight: 700 }}>{gateIssues.length} {gateIssues.length === 1 ? 'item' : 'items'} left</div>
                <p style={{ margin: '0.35rem 0 0', color: 'var(--h-text)', fontSize: '0.84rem', lineHeight: 1.45 }}><b>Next:</b> {gateIssues[0].label}.</p>
                <details style={{ marginTop: '0.45rem' }}>
                  <summary style={{ cursor: 'pointer', color: 'var(--h-text-dim)', fontSize: '0.72rem' }}>See every missing item</summary>
                  <ol style={{ margin: '0.55rem 0 0', paddingLeft: '1.25rem', color: 'var(--h-text-dim)' }}>
                    {gateIssues.map((issue) => (
                      <li key={issue.key} style={{ marginTop: '0.3rem' }}>
                        <button type="button" onClick={() => focusGateIssue(issue.targetId)} style={{ padding: 0, border: 'none', background: 'none', color: ORANGE_DEEP, textAlign: 'left', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.76rem' }}>{issue.label}</button>
                      </li>
                    ))}
                  </ol>
                </details>
              </div>
            )}

            <button type="button" onClick={enter} disabled={busy || uploading} aria-describedby={!canEnter ? 'experiment-gate-summary' : undefined} style={{ background: canEnter ? ORANGE : 'rgba(255,106,31,0.08)', color: canEnter ? '#fff' : ORANGE_DEEP, border: canEnter ? 'none' : '1px solid rgba(255,106,31,0.45)', borderRadius: 16, padding: '1.05rem', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.7rem', letterSpacing: '0.03em', cursor: busy || uploading ? 'wait' : 'pointer', boxShadow: canEnter ? '0 16px 44px -18px rgba(255,106,31,0.7)' : 'none' }}>
              {busy ? '…' : canEnter ? '✦ join the dating experiment' : 'show me what’s missing ↑'}
            </button>
            <p style={{ textAlign: 'center', fontSize: '0.72rem', lineHeight: 1.5, color: 'var(--h-text-faint)', margin: '0.4rem 0 0' }}>
              <b>*</b> No purchase necessary. Massachusetts residents 21+ within {ev.radiusMiles} miles of {ev.centerZip}. Up to two reciprocal options; only mutual yes pairs enter the final compatibility-weighted selection. Up to {ev.winnerPairCount || 2} disjoint pairs; ${ev.budget} maximum value per dinner. Odds depend on the qualified pool and private choices. Void where prohibited. <Link href="/dating-experiment/terms" style={{ color: ORANGE_DEEP }}>Official Rules</Link>.
            </p>
          </div>
        )}
        {err && <p role="alert" aria-live="assertive" style={{ color: ORANGE_DEEP, fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '0.9rem', textAlign: 'center', marginTop: '1rem' }}>{err}</p>}
      </div>
    </div>
  );
}

function ShortlistPanel({ offers, round, budget, busy, setBusy, setErr }: {
  offers: any[];
  round: any;
  budget: number;
  busy: boolean;
  setBusy: (value: boolean) => void;
  setErr: (value: string) => void;
}) {
  const [decisions, setDecisions] = useState<Record<string, { accept: boolean | null; favorite: boolean }>>(() =>
    Object.fromEntries(offers.map((offer) => [offer.id, { accept: offer.myAccepted, favorite: offer.myFavorite === true }])),
  );
  const locked = round?.allResponded || round?.status === 'resolving';
  const complete = offers.every((offer) => decisions[offer.id]?.accept !== null);

  function decide(id: string, accept: boolean) {
    setDecisions((current) => ({
      ...current,
      [id]: { accept, favorite: accept ? current[id]?.favorite === true : false },
    }));
  }
  function favorite(id: string) {
    setDecisions((current) => Object.fromEntries(Object.entries(current).map(([key, decision]) => [
      key,
      { ...decision, favorite: key === id ? !decision.favorite : false },
    ])));
  }
  async function submit() {
    if (!complete || busy) return;
    setBusy(true); setErr('');
    const payload = offers.map((offer) => ({
      pairId: offer.id,
      accept: decisions[offer.id].accept === true,
      favorite: decisions[offer.id].favorite === true,
    }));
    const response = await fetch('/api/raffle/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decisions: payload }),
    });
    if (response.ok) window.location.reload();
    else {
      const data = await response.json().catch(() => ({}));
      setErr(data.error || 'could not save your private choices');
      setBusy(false);
    }
  }

  if (locked) {
    return (
      <div style={{ ...card, border: `2px solid ${BLUE}`, textAlign: 'center' }}>
        <div style={{ fontSize: '2rem' }}>🔒</div>
        <h2 style={cardH}>your choices are sealed.</h2>
        <p style={cardP}>We’ll resolve the round when everyone responds or the private window closes. Only mutual yes pairs can be considered for the ${budget} dinner.</p>
        <Link href="/hub" style={backLink}>back to hub →</Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ ...card, border: `2px solid ${BLUE}`, marginBottom: '0.8rem' }}>
        <div style={cardLabel}>private shortlist · round {round?.roundNumber || 1}</div>
        <h2 style={{ ...cardH, marginTop: '0.35rem' }}>choose who you’d actually meet.</h2>
        <p style={cardP}>Say yes to one, both, or neither. If both appeal to you, mark one favorite. Your answers stay sealed; only mutual yes pairs enter the final dinner selection.</p>
        {offers.length === 1 && (
          <p style={{ ...cardP, marginTop: '0.55rem', fontSize: '0.78rem' }}><b>Why one option?</b> This was the only new person who cleared both people’s age and gender preferences, shared dinner availability, and the minimum fit score. We don’t force a weaker or one-way second choice.</p>
        )}
        {round?.responseDeadline && <p style={{ margin: '0.65rem 0 0', fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', color: 'var(--h-text-faint)', letterSpacing: '0.05em' }}>respond by {new Date(round.responseDeadline).toLocaleString()}</p>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: '0.8rem' }}>
        {offers.map((offer) => {
          const person = offer.candidate;
          const first = (person?.name || 'this person').split(' ')[0];
          const choice = decisions[offer.id] || { accept: null, favorite: false };
          return (
            <div key={offer.id} style={{ ...card, padding: '0.9rem', border: choice.accept === true ? `2px solid ${BLUE}` : choice.accept === false ? '1px solid var(--h-border)' : '1px solid rgba(37,99,255,0.3)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '0.35rem' }}>
                {[person?.photo_url, ...(person?.gallery || [])].filter(Boolean).slice(0, 4).map((src: string, index: number) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={`${src}-${index}`} src={src} alt={`${first} profile ${index + 1}`} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 9 }} />
                ))}
              </div>
              <div style={{ marginTop: '0.65rem', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '1.25rem' }}>{first}{person?.age ? `, ${person.age}` : ''}</h3>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', color: BLUE }}>{offer.score}% fit</span>
              </div>
              {person?.introVideoPreviewUrl && <video src={person.introVideoPreviewUrl} controls playsInline preload="metadata" style={{ width: '100%', display: 'block', marginTop: '0.55rem', borderRadius: 9, background: '#000' }} />}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.55rem' }}>
                {person?.orientation && <span style={profileFact}>{person.orientation}</span>}
                {person?.archetype && <span style={profileFact}>{String(person.archetype).replaceAll('-', ' ')}</span>}
              </div>
              {person?.bio && <p style={{ margin: '0.55rem 0 0', fontSize: '0.8rem', lineHeight: 1.45, color: 'var(--h-text-dim)' }}>{person.bio}</p>}
              {(person?.intention || person?.energy || person?.planningStyle) && (
                <div style={{ marginTop: '0.55rem', padding: '0.55rem 0.6rem', borderRadius: 9, background: 'var(--h-surface-2)', fontSize: '0.72rem', lineHeight: 1.5, color: 'var(--h-text-dim)' }}>
                  {person?.intention && <div><b style={{ color: 'var(--h-text)' }}>looking for:</b> {person.intention}</div>}
                  {person?.energy && <div><b style={{ color: 'var(--h-text)' }}>dinner vibe:</b> {person.energy}</div>}
                  {person?.planningStyle && <div><b style={{ color: 'var(--h-text)' }}>plans:</b> {person.planningStyle}</div>}
                </div>
              )}
              {person?.sharedInterests?.length > 0 && <p style={{ margin: '0.55rem 0 0', fontSize: '0.72rem', lineHeight: 1.4, color: BLUE }}><b>you both like:</b> {person.sharedInterests.join(' · ')}</p>}
              {person?.conversationStarter && <p style={{ margin: '0.55rem 0 0', fontSize: '0.8rem', lineHeight: 1.45, color: 'var(--h-text-dim)' }}><b style={{ color: 'var(--h-text)' }}>ask about:</b> {person.conversationStarter}</p>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginTop: '0.7rem' }}>
                <button onClick={() => decide(offer.id, true)} style={{ ...choiceBtn, background: choice.accept === true ? BLUE : 'var(--h-surface-2)', color: choice.accept === true ? '#fff' : 'var(--h-text)' }}>yes, I’d meet</button>
                <button onClick={() => decide(offer.id, false)} style={{ ...choiceBtn, background: choice.accept === false ? 'var(--h-text)' : 'var(--h-surface-2)', color: choice.accept === false ? 'var(--h-bg)' : 'var(--h-text-dim)' }}>pass privately</button>
              </div>
              {choice.accept === true && offers.length > 1 && <button onClick={() => favorite(offer.id)} style={{ width: '100%', marginTop: '0.4rem', border: 'none', background: 'none', color: choice.favorite ? ORANGE_DEEP : 'var(--h-text-faint)', cursor: 'pointer', fontSize: '0.72rem' }}>{choice.favorite ? '★ your favorite' : '☆ mark as favorite'}</button>}
            </div>
          );
        })}
      </div>
      <button onClick={submit} disabled={!complete || busy} style={{ width: '100%', marginTop: '0.9rem', border: 'none', borderRadius: 14, padding: '0.9rem', background: complete ? ORANGE : 'var(--h-surface-2)', color: complete ? '#fff' : 'var(--h-text-faint)', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.45rem', letterSpacing: '0.04em', cursor: complete && !busy ? 'pointer' : 'not-allowed' }}>{busy ? 'sealing…' : complete ? 'seal my private choices →' : 'decide on every option'}</button>
    </div>
  );
}

function RuleLine({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.6rem minmax(0,1fr)', gap: '0.55rem', alignItems: 'start' }}>
      <span aria-hidden="true" style={{ lineHeight: 1.4 }}>{icon}</span>
      <p style={{ margin: 0, color: 'var(--h-text-dim)', fontSize: '0.8rem', lineHeight: 1.45 }}><b style={{ color: 'var(--h-text)' }}>{title}.</b> {body}</p>
    </div>
  );
}

const card: React.CSSProperties = { background: 'var(--h-surface)', border: '1px solid var(--h-border)', borderRadius: 16, padding: '1.1rem 1.2rem' };
const cardH: React.CSSProperties = { fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '1.35rem', margin: '0 0 0.35rem', color: 'var(--h-text)' };
const cardP: React.CSSProperties = { fontFamily: 'system-ui, sans-serif', fontSize: '0.88rem', color: 'var(--h-text-dim)', lineHeight: 1.5, margin: 0 };
const cardLabel: React.CSSProperties = { fontFamily: "'DM Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: ORANGE_DEEP, fontWeight: 700 };
const qLabel: React.CSSProperties = { fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--h-text-faint)', marginBottom: '0.35rem' };
const btnGhost: React.CSSProperties = { minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--h-surface-2)', border: '1px solid var(--h-border)', borderRadius: 999, padding: '0.55rem 1.2rem', fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--h-text-dim)', textDecoration: 'none' };
const numIn: React.CSSProperties = { width: 64, minHeight: 44, background: 'var(--h-surface-2)', border: '1px solid var(--h-border)', borderRadius: 8, padding: '0.4rem 0.5rem', color: 'var(--h-text)', fontFamily: "'DM Mono', monospace", fontSize: '0.85rem' };
const backLink: React.CSSProperties = { display: 'inline-block', marginTop: '1rem', fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--h-text-dim)', textDecoration: 'none' };
const infoLink: React.CSSProperties = { display: 'inline-block', border: '1px solid var(--h-border)', borderRadius: 999, padding: '0.42rem 0.7rem', background: 'var(--h-surface)', fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--h-text-dim)', textDecoration: 'none' };
const choiceBtn: React.CSSProperties = { minHeight: 44, border: '1px solid var(--h-border)', borderRadius: 10, padding: '0.55rem 0.35rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' };
const profileFact: React.CSSProperties = { fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', color: BLUE, letterSpacing: '0.05em', textTransform: 'uppercase', padding: '0.2rem 0.35rem', borderRadius: 999, background: 'rgba(37,99,255,0.08)' };
const rulesBackdrop: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: 'max(1rem, env(safe-area-inset-top)) 1rem max(1rem, env(safe-area-inset-bottom))', background: 'rgba(10,8,14,0.72)', backdropFilter: 'blur(8px)', overflowY: 'auto' };
const rulesModal: React.CSSProperties = { width: 'min(100%, 520px)', maxHeight: 'calc(100dvh - 2rem)', overflowY: 'auto', boxSizing: 'border-box', background: 'var(--h-surface)', border: '1px solid rgba(255,106,31,0.34)', borderRadius: 22, padding: 'clamp(1rem,4vw,1.45rem)', boxShadow: '0 26px 80px rgba(0,0,0,0.35)' };
function chip(on: boolean): React.CSSProperties {
  return { minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: on ? ORANGE : 'var(--h-surface-2)', color: on ? '#fff' : 'var(--h-text-dim)', border: `1px solid ${on ? ORANGE : 'var(--h-border)'}`, borderRadius: 999, padding: '0.4rem 0.9rem', fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.04em', cursor: 'pointer' };
}

function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    const cleanup = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load();
    };
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('video metadata timeout'));
    }, 8000);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const duration = video.duration;
      cleanup();
      if (!Number.isFinite(duration) || duration <= 0) reject(new Error('invalid video duration'));
      else resolve(Math.round(duration * 100) / 100);
    };
    video.onerror = () => {
      cleanup();
      reject(new Error('invalid video'));
    };
    video.src = url;
  });
}
