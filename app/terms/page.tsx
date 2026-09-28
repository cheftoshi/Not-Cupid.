import type { Metadata } from 'next';
import LegalPage from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Terms of Service — NotCupid',
  description: 'NotCupid terms, pricing, subscription cancellation, refunds, community standards, and contact information.',
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" subtitle="Your rights and responsibilities when using NotCupid." updated="September 27, 2026">
      <p>These terms are an agreement between you and <strong>Lemon Labs</strong> (&quot;NotCupid,&quot; &quot;we,&quot; &quot;us&quot;) for use of the NotCupid app and site. By using NotCupid, you agree to them.</p>
      <p>NotCupid helps adults connect through dating, friendship, and member-created plans. Our <a href="/privacy">Privacy Policy</a> explains how we handle personal information, and our <a href="/safety">Safety &amp; Community Guidelines</a> explain our community standards.</p>
      <p><a href="#payments">Pricing and digital delivery</a> · <a href="#cancellation">Cancel a subscription</a> · <a href="#refunds">Refunds and credits</a> · <a href="#contact">Contact us</a></p>

      <h2>Who can use it</h2>
      <p>You must be <strong>18 or older</strong> and able to form a binding contract. One account per person. You&apos;re responsible for what happens under your account, so keep your email secure.</p>

      <h2>Community standards</h2>
      <p>NotCupid is for meeting people genuinely. You agree not to:</p>
      <ul>
        <li>Harass, threaten, demean, or endanger anyone.</li>
        <li>Impersonate someone else or post fake, misleading, or stolen photos/info.</li>
        <li>Solicit, spam, advertise, scam, or use NotCupid for any commercial purpose.</li>
        <li>Share sexually explicit, hateful, or illegal content.</li>
        <li>Collect or misuse other people&apos;s information, or try to break, probe, or abuse the service.</li>
      </ul>
      <p>These standards apply to profiles, private conversations, group chats, and plans. See our <a href="/safety">Safety &amp; Community Guidelines</a> for reporting and meeting-safety guidance.</p>

      <h2>Your content</h2>
      <p>You own what you post. By posting, you grant us a limited license to host and display it as needed to run the service (e.g. showing your profile to your matches). Don&apos;t post anything you don&apos;t have the right to share.</p>

      <h2 id="payments">Pricing and digital delivery</h2>
      <p>Basic profile viewing, accepting connections, replying, blocking, reporting, and member-created plans are free. Love Line includes three distinct outgoing picks per 24-hour roster cycle. Member-created date invitations are separate from paid Love roster picks and do not require payment.</p>
      <ul>
        <li><strong>AI Compatibility Read and extra Love connection: USD $0.99, one time.</strong> This provides a private, person-specific interpretation of six broad personality signals and includes one extra outgoing connection to that person. The read and connection are not charged separately.</li>
        <li><strong>Additional Friend Line pack: USD $0.99, one time.</strong> The first pack is free. Additional packs provide introductions subject to eligible people being available.</li>
        <li><strong>NotCupid Pro: USD $3.99 per month.</strong> Pro includes AI Compatibility Reads, extra Love picks, and additional Friend packs without separate per-item checkout. Eligibility, available members, safety rules, and connection-capacity limits still apply.</li>
      </ul>
      <p>Payments are processed by Stripe. The checkout shows the price, currency, billing frequency, and any applicable taxes before you confirm. These are digital services delivered in your NotCupid account after successful payment confirmation; no physical goods are shipped. If a completed purchase does not appear, contact us using the details below. A purchase does not guarantee a match, acceptance, reply, date, or accurate compatibility prediction.</p>

      <h2 id="cancellation">Subscriptions and cancellation</h2>
      <p>Pro renews automatically each month and charges your payment method until you cancel renewal. To stop the next renewal, sign in, open <a href="/pro">Pro</a> or your profile settings, and choose <strong>Cancel renewal</strong>. <strong>Manage subscription</strong> opens Stripe billing settings. Complete cancellation before your next renewal and check the confirmation.</p>
      <p>When renewal cancellation is confirmed, paid access remains through the end of the current billing period. Cancellation does not itself refund the current period. If cancellation cannot be confirmed or billing settings are unavailable, contact <a href="mailto:match@notcupid.com">match@notcupid.com</a> for help. Removing the installed app or signing out does not cancel a subscription.</p>

      <h2 id="refunds">Refunds and connection credits</h2>
      <p>Delivered one-time digital purchases are generally non-refundable. Subscription payments are generally non-refundable for the current billing period, including unused time after renewal cancellation, except where required by law. These policies do not limit any mandatory consumer rights.</p>
      <p>If you believe a charge is duplicated, incorrect, unauthorized, or paid access was not delivered, email <a href="mailto:match@notcupid.com">match@notcupid.com</a> with your account email, purchase date, and receipt or transaction reference so we can investigate and review a refund request. Do not send your full card number or security code.</p>
      <p>If a paid Love request is declined or expires before becoming mutual, its connection value returns automatically as an in-app extra-connection credit. The same credit applies if the selected person becomes unavailable before the connection is created. The original Compatibility Read remains tied to the original person; using the returned connection credit does not transfer that read or create another charge. This credit is not a cash refund. Ending your own outgoing request does not recycle a pick or paid credit.</p>

      <h2>Conversations and connection limits</h2>
      <p>A pending Love invitation lasts 72 hours. Once both people accept, the mutual chat has no inactivity deadline. After 10 days without a new message or chat activation, it moves to the Archived inbox filter rather than ending; a new message brings it back. Open mutual chats, including archived chats, count toward the ten-connection limit.</p>
      <p>Eligible mutual chats previously ended by automatic expiry may be restored once per chat, with up to three restores initiated per person in a rolling 30-day period. Both accounts must remain eligible and have capacity. Manually ended, passed, reported, and non-mutual expired connections are not eligible. Restoration does not override another person&apos;s safety controls.</p>

      <h2>Member-created plans and external events</h2>
      <p>Members organize their own plans. Two-person date invitations consist of a host and one accepted guest; requesting a place does not confirm acceptance. A blind invitation withholds identifying profile details until acceptance. Members remain free to decline or cancel participation. Tell the other participants promptly when your plans change, where it is safe to do so.</p>
      <p>Joining or posting a plan does not purchase tickets, book a venue, or cover food, transport, admission, or other costs. External event listings link to third-party providers; ticket availability, purchases, refunds, and event cancellation are subject to that provider&apos;s terms. NotCupid does not guarantee attendance or the accuracy or availability of a third-party listing.</p>

      <h2>Matching is not a guarantee</h2>
      <p>We curate compatible people using an algorithm, but we can&apos;t guarantee matches, replies, dates, chemistry, or outcomes. NotCupid is a tool for meeting people — what happens next is up to you and them.</p>

      <h2>Dating Experiment</h2>
      <p>The August 2026 Boston Dating Experiment is closed. Its <a href="/dating-experiment/terms">Official Rules &amp; Terms</a> remain available for that round. Any future experiment will have separately published dates, eligibility, and participation rules. Participation does not give us permission to use your likeness in advertising; marketing use requires separate consent.</p>

      <h2>AI suggestions</h2>
      <p>Some features may offer AI-assisted compatibility interpretations, prompts, Hub concierge routing, or next-move suggestions. They can be inaccurate or awkward and are not psychological testing, professional advice, or a promise of compatibility or response. The AI Compatibility Read uses broad bands from NotCupid&apos;s abbreviated HEXACO-inspired quiz and pair-level signals; it is not the full HEXACO research inventory and does not reveal raw answers or exact trait scores. The Hub concierge asks permission before sending the message you type and its disclosed limited context to our AI provider. You decide whether to use or ignore every suggestion. NotCupid&apos;s AI features do not send messages, accept people, RSVP, join groups, post, book, or pay automatically.</p>

      <h2>Account deletion and suspension</h2>
      <p>You can request account deletion from profile settings. Deletion removes your profile from discovery and initiates cancellation of a linked Pro subscription. If billing cancellation cannot be confirmed, contact support; cancellation and deletion do not automatically refund prior payments. Limited payment, safety, fraud-prevention, and legal records may be retained as explained in our <a href="/privacy">Privacy Policy</a>.</p>
      <p>We may restrict, suspend, or remove accounts for violations of these terms or community guidelines. Report-based safeguards can also temporarily pause matching; follow the in-app notice or contact support for review. A chat does not automatically expire because you have not replied. You are never required to continue a conversation, attend a plan, or remain in an interaction that makes you uncomfortable.</p>

      <h2>Safety disclaimer</h2>
      <p>We do not run criminal background checks on members. You are responsible for your own interactions. Always follow our <a href="/safety">safety guidance</a> — meet in public, tell a friend, and trust your gut.</p>

      <h2>Disclaimers and limits of liability</h2>
      <p>NotCupid is provided &quot;as is,&quot; without warranties of any kind. To the fullest extent allowed by law, Lemon Labs is not liable for indirect or consequential damages arising from your use of the service, and our total liability is limited to the amount you paid us in the prior 12 months. These terms are governed by the laws of the <strong>Commonwealth of Massachusetts</strong>.</p>
      <p>Nothing in these terms excludes rights, warranties, or liabilities that cannot lawfully be excluded or limited.</p>

      <h2>Changes</h2>
      <p>We may update these terms; we&apos;ll change the date above when we do. Continued use means you accept the current version.</p>

      <h2 id="contact">Contact and business information</h2>
      <p><strong>Lemon Labs, operator of NotCupid</strong><br />109 California Ave<br />Quincy, MA 02169, United States</p>
      <p>For account help, billing, cancellation, or refund requests, email <a href="mailto:match@notcupid.com">match@notcupid.com</a>.</p>
    </LegalPage>
  );
}
