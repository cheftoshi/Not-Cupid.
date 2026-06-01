import type { Metadata } from 'next';
import LegalPage from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Terms of Service — NotCupid',
  description: 'The rules of the road for using NotCupid.',
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" subtitle="The rules of the road. Be cool, and this all works." updated="June 2026">
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
      <p>Some features are paid — for example, unlocking a full match profile, extra Friend Line crews, or Friend Line Pro. Prices are shown before you pay and processed by Stripe. Because these are digital goods delivered immediately, payments are generally <strong>non-refundable</strong> except where required by law. We may change pricing going forward.</p>

      <h2>Matching is not a guarantee</h2>
      <p>We curate compatible people using an algorithm, but we can&apos;t guarantee matches, replies, dates, chemistry, or outcomes. NotCupid is a tool for meeting people — what happens next is up to you and them.</p>

      <h2>Ending things</h2>
      <p>You can delete your account anytime. We may suspend or pause access if you break these terms or our guidelines — including repeated ghosting, which can pause your matching on both lines (see the in-app notice for how to get back in). For serious or repeated violations we may remove you entirely.</p>

      <h2>Safety disclaimer</h2>
      <p>We do not run criminal background checks on members. You are responsible for your own interactions. Always follow our <a href="/safety">safety guidance</a> — meet in public, tell a friend, and trust your gut.</p>

      <h2>The legal bits</h2>
      <p>NotCupid is provided &quot;as is,&quot; without warranties of any kind. To the fullest extent allowed by law, Lemon Labs is not liable for indirect or consequential damages arising from your use of the service, and our total liability is limited to the amount you paid us in the prior 12 months. These terms are governed by the laws of the <strong>Commonwealth of Massachusetts</strong>.</p>

      <h2>Changes</h2>
      <p>We may update these terms; we&apos;ll change the date above when we do. Continued use means you accept the current version.</p>

      <p style={{ marginTop: '1.5rem', color: '#6b6b76', fontSize: '0.85rem' }}>Questions? <a href="mailto:match@notcupid.com">match@notcupid.com</a>.</p>
    </LegalPage>
  );
}
