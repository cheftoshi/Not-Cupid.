import type { Metadata } from 'next';
import LegalPage from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Terms of Service — NotCupid',
  description: 'The rules of the road for using NotCupid.',
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" subtitle="The rules of the road. Be cool, and this all works." updated="August 2026">
      <p>These terms are an agreement between you and <strong>Lemon Labs</strong> (&quot;NotCupid,&quot; &quot;we,&quot; &quot;us&quot;) for use of the NotCupid app and site. By using NotCupid, you agree to them.</p>

      <h2>Who can use it</h2>
      <p>You must be <strong>18 or older</strong> and able to form a binding contract. One account per person. You&apos;re responsible for what happens under your account, so keep your email secure.</p>

      <h2>Be a good human</h2>
      <p>NotCupid is for meeting people genuinely. You agree not to:</p>
      <ul>
        <li>Harass, threaten, demean, or endanger anyone.</li>
        <li>Impersonate someone else or post fake, misleading, or stolen photos/info.</li>
        <li>Solicit, spam, advertise, scam, or use NotCupid for any commercial purpose.</li>
        <li>Share sexually explicit, hateful, or illegal content.</li>
        <li>Collect or misuse other people&apos;s information, or try to break, probe, or abuse the service.</li>
      </ul>
      <p>See our <a href="/safety">Safety &amp; Community Guidelines</a> for the spirit of all this.</p>

      <h2>Your content</h2>
      <p>You own what you post. By posting, you grant us a limited license to host and display it as needed to run the service (e.g. showing your profile to your matches). Don&apos;t post anything you don&apos;t have the right to share.</p>

      <h2>Payments</h2>
      <p>Core profiles, accepting, replying, blocking, reporting, and planning are free. Each Love roster includes three distinct connection picks. A one-time $0.99 AI Compatibility Read provides a private, person-specific interpretation of the six broad personality signals between you and includes one extra outgoing connection to that person; you are not charged separately for the read and connection. A match, acceptance, reply, or accurate prediction is not guaranteed. If the recipient declines or the paid request expires before becoming mutual, the connection value automatically returns to the picker as an in-app extra-connection credit while the already-delivered read remains available. The same credit applies if the selected person becomes unavailable before the connection is created. Ending your own outgoing request does not recycle a pick or paid credit. Other optional paid features include additional Friend Line packs and NotCupid Pro. Prices and what is included are shown before you pay and processed by Stripe. Because these are digital goods delivered immediately, payments are generally <strong>non-refundable</strong> except where required by law. We may change pricing going forward.</p>

      <h2>Matching is not a guarantee</h2>
      <p>We curate compatible people using an algorithm, but we can&apos;t guarantee matches, replies, dates, chemistry, or outcomes. NotCupid is a tool for meeting people — what happens next is up to you and them.</p>

      <h2>Dating Experiment</h2>
      <p>The optional Boston Dating Experiment has additional eligibility, reciprocal-shortlist, prize, video, consent, and safety rules. Those <a href="/dating-experiment/terms">Dating Experiment Official Rules &amp; Terms</a> are presented separately and must be accepted before entry. Joining is free, paid membership does not improve offers or selection odds, and entering does not give us permission to use your likeness in advertising.</p>

      <h2>AI suggestions</h2>
      <p>Some features may offer AI-assisted compatibility interpretations, prompts, or next-move suggestions. They can be inaccurate or awkward and are not psychological testing, professional advice, or a promise of compatibility or response. The AI Compatibility Read uses broad bands from NotCupid&apos;s abbreviated HEXACO-inspired quiz and pair-level signals; it is not the full HEXACO research inventory and does not reveal raw answers or exact trait scores. You decide whether to use or ignore it. NotCupid&apos;s AI features do not send messages or take actions automatically.</p>

      <h2>Ending things</h2>
      <p>You can delete your account anytime. We may suspend or pause access if you break these terms or our guidelines — including repeated ghosting, which can pause your matching on both lines (see the in-app notice for how to get back in). For serious or repeated violations we may remove you entirely.</p>

      <h2>Safety disclaimer</h2>
      <p>We do not run criminal background checks on members. You are responsible for your own interactions. Always follow our <a href="/safety">safety guidance</a> — meet in public, tell a friend, and trust your gut.</p>

      <h2>The legal bits</h2>
      <p>NotCupid is provided &quot;as is,&quot; without warranties of any kind. To the fullest extent allowed by law, Lemon Labs is not liable for indirect or consequential damages arising from your use of the service, and our total liability is limited to the amount you paid us in the prior 12 months. These terms are governed by the laws of the <strong>Commonwealth of Massachusetts</strong>.</p>

      <h2>Changes</h2>
      <p>We may update these terms; we&apos;ll change the date above when we do. Continued use means you accept the current version.</p>

      <p style={{ marginTop: '1.5rem', color: 'var(--h-text-dim)', fontSize: '0.85rem' }}>Questions? <a href="mailto:match@notcupid.com">match@notcupid.com</a>.</p>
    </LegalPage>
  );
}
