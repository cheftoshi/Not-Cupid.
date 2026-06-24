import type { Metadata } from 'next';
import LegalPage from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Privacy Policy — NotCupid',
  description: 'What NotCupid collects, how we use it, who we share it with, and the choices and rights you have over your data.',
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" subtitle="Plain-English version of what we collect and why." updated="June 2026">
      <p>NotCupid is a connection experiment operated by <strong>Lemon Labs</strong>, available across New England, the New York City metro, and northern New Jersey. The whole product only works on trust, so this page explains — in plain English — what we collect, why, who we share it with, and the control you have. Questions or requests about your data? Email <a href="mailto:match@notcupid.com">match@notcupid.com</a>.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account &amp; profile:</strong> your name, email, age, ZIP code, the gender you are and who you&apos;re looking for, your photos and gallery, your bio, interests, and (optionally) your sun sign.</li>
        <li><strong>Sensitive details (you choose to share these):</strong> because we&apos;re a dating and friendship app, some of what you tell us is sensitive — who you&apos;re attracted to / seeking, whether you identify as LGBTQ+ (only if you opt to share it), your photos, your approximate location, and the personality, attachment, and values signals (including a health &amp; fitness question) computed from your quiz. You give us these so we can match you. See &quot;Sensitive information&quot; below.</li>
        <li><strong>Content you create:</strong> messages and group-chat posts, activities/events you post or RSVP to, date feedback you submit, and contest/raffle entries (including any short intro video).</li>
        <li><strong>Activity:</strong> who you connect with, accept or pass, your friendship packs and connections, and lightweight product analytics (pages viewed, features used) so we can improve the app.</li>
        <li><strong>Payments:</strong> when you pay (a Love-Line profile unlock, a friendship pack, or Pro), <strong>Stripe</strong> processes it — we never see or store your full card number. We keep a record of the transaction and your subscription status.</li>
        <li><strong>Notifications &amp; technical:</strong> if you turn on push notifications, your device&apos;s push subscription; plus standard server logs (IP address, browser) that come with any website, used for security and debugging.</li>
      </ul>

      <h2>Sensitive information</h2>
      <p>A dating app necessarily handles information many privacy laws treat as <strong>sensitive</strong> — your sexual orientation / who you&apos;re attracted to, precise-ish location, photos, and personality data. By providing this information and using NotCupid, <strong>you consent to our using it for the matching and product purposes described here.</strong> We don&apos;t use it for anything else, we don&apos;t sell it, and you can edit or delete it at any time (see &quot;Your rights &amp; choices&quot;).</p>

      <h2>How we use it</h2>
      <ul>
        <li><strong>To match you</strong> — your quiz, location, age range, and preferences drive who you see and who sees you. Matching is algorithmic (see &quot;Automated matching&quot;).</li>
        <li><strong>To run the product</strong> — show your profile to your matches, deliver messages, send the emails and notifications you&apos;ve opted into, and process payments.</li>
        <li><strong>To keep people safe</strong> — investigate reports, enforce our community guidelines, and prevent abuse and fraud.</li>
        <li><strong>To improve NotCupid</strong> — using aggregated, de-identified analytics and research. We never use this to identify you to outsiders.</li>
      </ul>
      <p>We <strong>do not sell or &quot;share&quot; your personal information</strong> (as those terms are used in U.S. privacy laws), and we don&apos;t show third-party ads.</p>

      <h2>Cookies &amp; analytics</h2>
      <p>We use first-party cookies only: a sign-in/session cookie to keep you logged in, and lightweight first-party analytics (which pages and features get used) to improve the app. We don&apos;t run third-party advertising trackers and we don&apos;t sell data to ad networks.</p>

      <h2>Who we share it with</h2>
      <p>Only the service providers we need to run NotCupid, and only the minimum they need:</p>
      <ul>
        <li><strong>Supabase</strong> — our database and photo/video storage.</li>
        <li><strong>Vercel</strong> — hosting.</li>
        <li><strong>Resend</strong> — sending email.</li>
        <li><strong>Stripe</strong> — processing payments (we never see or store your full card details).</li>
        <li><strong>Push delivery services</strong> — to send the notifications you opt into.</li>
        <li><strong>Ticketmaster / Yelp / local event sources</strong> — to surface public events and date ideas. These don&apos;t receive your personal data.</li>
      </ul>
      <p><strong>People on NotCupid:</strong> your matches and connections see your profile (see &quot;What your matches see&quot;), and anyone in a group/crew chat with you sees your messages there.</p>
      <p><strong>Press / publications — only with your explicit consent.</strong> From time to time we may invite people who&apos;ve been on a date to share their experience with a publication. We only contact you about this, and we only share what you specifically agree to — replying to such an invitation never obligates you, and we won&apos;t share a word without your okay.</p>
      <p>We may also disclose information if required by law or to protect someone&apos;s safety.</p>

      <h2>Contests &amp; the raffle</h2>
      <p>If you enter a NotCupid contest or raffle (such as the Summer of Connection series), we collect your entry, your match basics, and your optional intro video. By entering you agree to that contest&apos;s <a href="/raffle/rules">Official Rules</a>, which include a likeness release allowing us to use your name, city, photo, and video for promoting the contest. A winning pair&apos;s prize details (venue and time) are shared only with the two of them.</p>

      <h2>What your matches see</h2>
      <p>Your first name, age, photo(s), bio, and interests are visible to people you match or connect with (a match&apos;s full Love-Line profile unlocks for a one-time fee or with Pro). We <strong>never</strong> show your exact address or ZIP — only a metro label (e.g.&nbsp;&quot;Boston, MA&quot;) and a fuzzy distance band.</p>

      <h2>Your rights &amp; choices</h2>
      <ul>
        <li><strong>Access &amp; correct:</strong> view and update your profile any time; email us for a copy of the personal data we hold about you.</li>
        <li><strong>Start fresh:</strong> wipe your quiz, profile, and matches and begin again.</li>
        <li><strong>Email:</strong> unsubscribe from any email via the link in its footer, or in your settings (this also opts you out of the matching/notification pool).</li>
        <li><strong>Notifications:</strong> turn push notifications on or off on your device at any time.</li>
        <li><strong>Delete your account:</strong> from your profile settings — this removes your profile and takes you out of the matching pool. Email <a href="mailto:match@notcupid.com">match@notcupid.com</a> if you need help.</li>
        <li><strong>No sale, no discrimination:</strong> we don&apos;t sell or share your personal information, and we won&apos;t treat you differently for exercising any of these choices.</li>
      </ul>
      <p>To make any request, email <a href="mailto:match@notcupid.com">match@notcupid.com</a> from your account email and we&apos;ll take care of it.</p>

      <h2>Automated matching</h2>
      <p>Who you see, and who sees you, is decided by an algorithm using your quiz, preferences, age range, and location. This isn&apos;t a decision with legal effects — you stay in control: you choose who to connect with, and you can refresh your roster or reset your profile any time.</p>

      <h2>Retention &amp; security</h2>
      <p>We keep your data while your account is active. When you delete your account, we remove your profile and matchability; limited records (for example, payment records, or safety, fraud-prevention, and legal needs) may persist where required. We use industry-standard measures — encryption in transit, access controls, and server-only access to our database — to protect your data, though no online service can promise perfect security.</p>

      <h2>Where your data lives</h2>
      <p>NotCupid serves the U.S. Northeast, and your data is stored and processed in the <strong>United States</strong> by our U.S.-based providers. NotCupid isn&apos;t intended for use outside our service area.</p>

      <h2>Age</h2>
      <p>NotCupid is strictly for people <strong>18 and older</strong> (some features, like the raffle dinner, are 21+). We don&apos;t knowingly collect data from anyone under 18; if we learn we have, we delete it.</p>

      <h2>Changes</h2>
      <p>If we make material changes to this policy, we&apos;ll update the date above and, where appropriate, let you know in the app. Continued use means you accept the current version.</p>

      <p style={{ marginTop: '1.5rem', color: 'var(--h-text-dim)', fontSize: '0.85rem' }}>This policy is written to be readable, not to be legalese. For any question or request about your data, reach us at <a href="mailto:match@notcupid.com">match@notcupid.com</a>.</p>
    </LegalPage>
  );
}
