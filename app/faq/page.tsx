import Link from 'next/link';

export const dynamic = 'force-static';

// FAQ — linked from the landing header. Same palette/voice as /how-it-works.
const INK = '#0a0a0a';
const BLUE = '#064c48';
const BLUE_DEEP = '#064c48';
const ORANGE = '#8a6500';

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Can I find an event and invite people to go with me?',
    a: 'Yes. Choose Find something to do on Home or the new Friend home to browse outside events for your selected city. Ticketmaster listings are labeled separately from member invitations. Pick Find people to go with, review your invitation, choose your meeting area and group size, then publish. Joining opens the existing participant plan chat; it does not purchase a ticket or reserve admission. Check current prices, age restrictions, venue and availability with the event provider before going. Outside listings can change or be unavailable without affecting your member plans or chats.',
  },
  {
    q: 'What is NotCupid?',
    a: 'A place to make real connections. Home shows invitations from NotCupid members for walks, dates, and small-group plans. Love Line offers curated dating connections, Friend Line helps you find platonic company, and your AI coach is there when you want a little help.',
  },
  {
    q: 'Are date invitations on Home free?',
    a: 'Yes. Creating a date, requesting to join, accepting one guest, and chatting afterward are free. They do not use your Love Line picks or require a payment. A date has two people: its host and one accepted guest. Both must be 18 or older, and requests must meet the invitation’s gender preferences. The host chooses who joins.',
  },
  {
    q: 'How do blind dates and meeting places work?',
    a: 'Profile-first dates show a basic profile before you request. Blind dates withhold names, photos, and bios until the host accepts; age, gender, and interests stay visible. Blind does not mean anonymous: avoid identifying details in your invitation. Date venues are shared only with the accepted pair. Friendship hosts can choose a public venue or keep it visible only to joined participants. Neighborhood distances are approximate, not GPS or travel times. Always meet in public.',
  },
  {
    q: 'How does the matching actually work?',
    a: 'A personality quiz — HEXACO traits, your attachment style, what you value, and a rapid-fire round — powers it. We score real compatibility on who you are and what you want, not photos or a swipe count, then show up to ten curated options: three included connection picks plus seven browseable alternatives.',
  },
  {
    q: 'No swiping — really?',
    a: 'Really. Endless swiping is what burns people out and turns dating into a numbers game. We show you a few people who actually fit and let you choose. That’s the whole point.',
  },
  {
    q: 'Is it free?',
    a: 'The quiz and every Love roster profile are free. Each 24-hour roster includes three distinct connection picks. A one-time $0.99 AI Compatibility Read explains all six HEXACO-inspired personality signals between you and one person and includes an extra connection to them—so you are never charged twice for the read and the pick. If that connection is declined or expires before becoming mutual, its value returns as an in-app extra-connection credit while the read stays open. The recipient never pays to accept or reply. Blocking and reporting are always free. On Friend, your first friendship pack is free and additional packs are $0.99. Pro is $3.99/mo and includes compatibility reads, extra Love picks, and unlimited Friend packs.',
  },
  {
    q: 'What does the AI Compatibility Read show?',
    a: 'It is private decision support for you: all six personality dimensions in broad bands, where your patterns may align or differ, two potential strengths, useful watch-outs, and a low-pressure first-date angle. It does not expose raw quiz answers or exact trait scores, read messages, diagnose anyone, or promise chemistry. NotCupid uses an abbreviated HEXACO-inspired screen—not the full research inventory—and shows a curated fallback if the AI service is unavailable.',
  },
  {
    q: 'Where is NotCupid available?',
    a: 'NotCupid supports cities across New England, including Boston and Providence, plus the New York City metro and North Jersey. Love suggestions use your preferences and distance settings; Friend discovery and plans use your selected metro. Available people and plans vary by city. A supported city does not guarantee a match or an active plan.',
  },
  {
    q: 'What’s the Friend Line?',
    a: 'The platonic side, same personality engine. It’s for finding your people — weekly packs, 1:1 connections, a pack chat, the Scene for real plans, and City Pulse for clubs, community hubs, and what neighborhoods are active.',
  },
  {
    q: 'What’s the quiz like?',
    a: 'About four minutes of questions about personality, lifestyle, and preferences. Answer for how you usually feel, not who you think you should be. The quiz does not detect dishonesty, diagnose personality, or guarantee compatibility.',
  },
  {
    q: 'Can I do both Love and Friend?',
    a: 'Yes. Your core quiz powers both lines — board whichever you want, or both.',
  },
  {
    q: 'What if I don’t respond to my matches?',
    a: 'A pending Love invitation lasts up to 72 hours. Mutual chats have no reply deadline. After 10 days without activity, they move to Archived; a new message brings them back. Archived chats still count toward your connection limit. Previously mutual chats closed by the old inactivity timer can be restored from Past conversations: three restores per 30 days, once per chat, subject to both people’s connection limits. Passed, reported, blocked, deleted-account and manually ended connections cannot be restored. Three unanswered incoming decisions pause new incoming roster exposure until you respond with Yes or Pass. You never need to accept someone to stay eligible. A ghost strike requires at least 24 hours of mutual acceptance and no messages from the reported person in that conversation. Three lifetime strikes pause matching.',
  },
  {
    q: 'How do you keep things safe?',
    a: 'Love conversations and Friend DMs, crew chats, club chats, and plan chats have reporting controls. Friend reports disconnect the pair and hide their shared-chat messages from each other; the reported person is not notified of the report. Neighborhood distance is approximate. A plan’s meeting place may be public or participant-only, so do not post a home address. Date venues are shared with the confirmed pair.',
  },
  {
    q: 'What is the NotCupid Dating Experiment?',
    a: 'A Boston-first experiment whose August 20 dinner round is now closed to new entries. A private intro video was optional and never changed eligibility or selection. A coverage-first system gives qualified entrants up to two reciprocal options. People privately say yes to either, both, or neither; only mutual yes pairs enter the final compatibility-weighted selection for up to two dinner pairs, each covered up to $200. Nobody can win twice, and paid membership never improves offers or odds.',
  },
  {
    q: 'How do I install the app — and turn on notifications?',
    a: 'NotCupid runs in your browser, but you can install it like a real app. On iPhone: open notcupid.com in Safari, tap the Share icon (the square with an arrow), scroll to “Add to Home Screen,” then open NotCupid from your Home Screen. On Android / desktop Chrome: tap “install the app” when the prompt appears, or use the browser menu → Install. Notifications: Android and desktop can turn them on right in the browser, but iPhone only allows notifications once you’ve installed the app to your Home Screen (iOS 16.4+) — they don’t work in the Safari tab. So on iPhone: install first, open the app from your Home Screen, then tap “🔔 get pinged when you match.” The installable web app is the current version; no App Store download is required.',
  },
  {
    q: 'How do I cancel Pro?',
    a: 'Open Manage subscription on the Pro page or in profile settings. You can manage billing through Stripe or use Cancel renewal to stop the next renewal while keeping the remaining paid period. If cancellation fails, retry or contact match@notcupid.com; a failed attempt is not confirmation of cancellation.',
  },
  {
    q: 'Where do I chat after joining a plan?',
    a: 'On Home, open Your conversations. A friendship plan opens its participant chat after you join; a date chat opens only after the host accepts one guest. Joining a group plan does not automatically create a private Friend DM. Cancelled date chats remain read-only, subject to account and safety restrictions.',
  },
  {
    q: 'How do I delete my account?',
    a: 'Use Delete account in profile settings. Your profile is deactivated and removed from matching. The app also attempts to cancel your linked Pro subscription and remove uploaded profile media. If billing or storage cleanup fails, it shows a warning and records the failure for follow-up. Limited payment and safety records may be retained as described in the privacy policy.',
  },
];

export default function FAQ() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--h-bg)', color: 'var(--h-text)', fontFamily: 'ui-sans-serif,system-ui,sans-serif' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontFamily: "'Space Grotesk', Georgia, ui-serif, serif", fontStyle: 'italic', fontWeight: 700, fontSize: '1.15rem', color: BLUE }}>not<span style={{ color: ORANGE }}>cupid</span></span>
            <span style={{ fontFamily: "'DM Sans', monospace", fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--h-accent)' }}>faq</span>
          </div>
          <Link href="/" style={{ fontFamily: "'DM Sans', monospace", fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--h-accent)', textDecoration: 'none' }}>← back</Link>
        </div>

        <div style={{ fontFamily: "'DM Sans', monospace", fontSize: '0.6rem', letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--h-text-dim)', marginBottom: '0.6rem' }}>a connection experiment</div>
        <h1 style={{ fontFamily: 'Space Grotesk, ui-serif, serif', fontStyle: 'italic', fontSize: 'clamp(2.6rem,9vw,3.8rem)', lineHeight: 1, color: 'var(--h-text)', margin: '0 0 0.5rem' }}>
          questions? <span style={{ color: BLUE }}>answers.</span>
        </h1>
        <p style={{ fontFamily: 'Space Grotesk, serif', fontStyle: 'italic', color: 'var(--h-text-dim)', fontSize: '1.05rem', margin: '0 0 2rem' }}>
          everything you’d want to know before you sign up.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {FAQS.map((f) => (
            <div key={f.q} style={{ background: 'var(--h-surface)', border: '1px solid rgba(6,76,72,0.18)', borderRadius: 16, boxShadow: '0 10px 30px -22px rgba(27,70,201,0.45)', padding: '1.1rem 1.25rem' }}>
              <div style={{ fontFamily: 'Space Grotesk, ui-serif, serif', fontStyle: 'italic', fontSize: '1.2rem', color: 'var(--h-text)', marginBottom: '0.35rem' }}>{f.q}</div>
              <p style={{ margin: 0, fontSize: '0.92rem', lineHeight: 1.6, color: 'var(--h-text-dim)' }}>{f.a}</p>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
          <Link href="/how-it-works" style={{ fontFamily: "'DM Sans', monospace", fontSize: '0.62rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--h-accent)', textDecoration: 'none', borderBottom: `1px dashed ${BLUE}`, paddingBottom: '0.15rem' }}>
            still curious? see how it works →
          </Link>
          <Link href="/quiz" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.5rem', letterSpacing: '0.05em', color: '#fff', background: INK, border: 'none', borderRadius: 14, padding: '0.8rem 2rem', boxShadow: '0 14px 30px -12px rgba(0,0,0,0.5)', textDecoration: 'none', display: 'inline-block' }}>
            get started →
          </Link>
        </div>
      </div>
    </div>
  );
}
