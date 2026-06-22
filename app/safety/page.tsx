import type { Metadata } from 'next';
import LegalPage from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Safety & Community Guidelines — NotCupid',
  description: 'How to stay safe meeting people through NotCupid, and the standards we hold everyone to.',
};

export default function SafetyPage() {
  return (
    <LegalPage title="Safety First" subtitle="Meeting new people should feel good. Here's how we keep it that way." updated="June 2026">
      <p>NotCupid connects real people in real life. That only works if everyone looks out for each other. Here&apos;s our part and yours.</p>

      <h2>Meeting someone for the first time</h2>
      <ul>
        <li><strong>Meet in public</strong> — a café, a busy spot, somewhere with people around. Save the private settings for when you know each other.</li>
        <li><strong>Tell a friend</strong> — share where you&apos;re going and who with. Check in after.</li>
        <li><strong>Get there on your own</strong> — arrange your own transport, both ways, so you&apos;re never stuck.</li>
        <li><strong>Stay sober enough to stay sharp</strong>, and keep an eye on your drink.</li>
        <li><strong>Trust your gut</strong> — if something feels off, you owe no one an explanation. Leave.</li>
      </ul>

      <h2>The standard we hold everyone to</h2>
      <p>On both the Love Line and the Friend Line, you agree to:</p>
      <ul>
        <li>Be honest — real name, real photos, real you.</li>
        <li>Be respectful — no harassment, pressure, hate, or threats, ever.</li>
        <li>Take &quot;no&quot; gracefully — a pass or an unmatch is always okay.</li>
        <li>Keep it human — no spam, soliciting, scams, or selling.</li>
        <li>Be 18 or older. NotCupid is adults only.</li>
      </ul>

      <h2>Report &amp; block</h2>
      <p>If someone makes you uncomfortable, you can <strong>block and report</strong> them right from the match card or chat — it ends the match, blocks them from re-matching with you, and sends it to our team for review. You can also email <a href="mailto:match@notcupid.com">match@notcupid.com</a> anytime. We read every report.</p>

      <h2>On ghosting</h2>
      <p>We want NotCupid to feel considerate, so we gently discourage ghosting your matches. Repeatedly going silent on people you&apos;ve connected with can pause your matching — but it&apos;s a soft, reversible nudge toward being a good crewmate, not a punishment. Life happens; just let people down kindly when you can.</p>

      <h2>If you&apos;re ever in danger</h2>
      <p>If you feel unsafe or are threatened, contact local authorities — in the U.S., call <strong>911</strong>. For confidential support, the <strong>988 Suicide &amp; Crisis Lifeline</strong> (call or text 988) is available 24/7. Your safety always comes before any match.</p>

      <p style={{ marginTop: '1.5rem', color: 'var(--h-text-dim)', fontSize: '0.85rem' }}>Concerns about someone, or about your experience? Reach a real person at <a href="mailto:match@notcupid.com">match@notcupid.com</a>.</p>
    </LegalPage>
  );
}
