import type { Metadata } from 'next';
import LegalPage from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Privacy Policy — NotCupid',
  description: 'What NotCupid collects, how we use it, and the choices you have over your data.',
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" subtitle="Plain-English version of what we collect and why." updated="June 2026">
      <p>NotCupid is a Boston-born social experiment (now across the Northeast — New England + New York City) operated by <strong>Lemon Labs</strong>. We take your data seriously because the whole product only works on trust. This page explains what we collect, how we use it, and the control you have. Questions? Email <a href="mailto:match@notcupid.com">match@notcupid.com</a>.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>What you give us:</strong> your name, age, email, ZIP code, the gender you are and who you&apos;re looking for, your photos, your bio and interests, your quiz answers (used to compute a personality profile), and the messages you send.</li>
        <li><strong>What you do here:</strong> matches you make, who you accept or pass, activities you post or RSVP to, and basic product analytics (pages viewed, features used) so we can improve the app.</li>
        <li><strong>Technical basics:</strong> standard server logs (IP, browser) that come with any website, used for security and debugging.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To match you — your quiz, location, age range, and preferences drive who you see and who sees you.</li>
        <li>To run the product — show your profile to your matches, deliver messages, send the emails you&apos;ve opted into (matches, reminders), and process payments.</li>
        <li>To keep people safe — investigate reports, enforce our guidelines, and prevent abuse.</li>
      </ul>
      <p>We <strong>do not sell your personal data</strong>, and we don&apos;t show third-party ads.</p>

      <h2>Who we share it with</h2>
      <p>Only the service providers we need to run NotCupid, and only the minimum they need:</p>
      <ul>
        <li><strong>Supabase</strong> — our database and photo storage.</li>
        <li><strong>Vercel</strong> — hosting.</li>
        <li><strong>Resend</strong> — sending email.</li>
        <li><strong>Stripe</strong> — processing payments (we never see or store your full card details).</li>
        <li><strong>Ticketmaster / Yelp / local event sources</strong> — to surface public events and date ideas. These don&apos;t receive your personal data.</li>
      </ul>
      <p>We may also disclose information if required by law or to protect someone&apos;s safety.</p>

      <h2>Your matches see</h2>
      <p>Your first name, age, photo(s), bio, and interests are visible to people you match with. We never show your exact address or ZIP — only a metro label (e.g. &quot;Boston, MA&quot;) and a fuzzy distance band.</p>

      <h2>Your choices</h2>
      <ul>
        <li><strong>Edit or refresh:</strong> update your profile anytime, or use &quot;start fresh&quot; to wipe your quiz, profile, and matches and begin again.</li>
        <li><strong>Email:</strong> unsubscribe from any email via the link in its footer, or in your settings.</li>
        <li><strong>Delete your account:</strong> from your profile page — this removes your profile and takes you out of the matching pool. Email <a href="mailto:match@notcupid.com">match@notcupid.com</a> if you need help.</li>
      </ul>

      <h2>Retention &amp; security</h2>
      <p>We keep your data while your account is active. When you delete your account, we remove your profile and matchability; limited records may persist where needed for safety, fraud-prevention, or legal reasons. We use industry-standard measures (encryption in transit, access controls) to protect your data, though no online service can promise perfect security.</p>

      <h2>Age</h2>
      <p>NotCupid is strictly for people <strong>18 and older</strong>. We don&apos;t knowingly collect data from anyone under 18; if we learn we have, we delete it.</p>

      <h2>Changes</h2>
      <p>If we make material changes to this policy, we&apos;ll update the date above and, where appropriate, let you know in the app. Continued use means you accept the current version.</p>

      <p style={{ marginTop: '1.5rem', color: '#6b6b76', fontSize: '0.85rem' }}>This policy is written to be readable, not to be legalese. For questions about your data, reach us at <a href="mailto:match@notcupid.com">match@notcupid.com</a>.</p>
    </LegalPage>
  );
}
