import type { Metadata } from 'next';
import LegalPage from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Law Enforcement Request Protocol — NotCupid',
  description: 'How law enforcement can submit legal, preservation, and emergency requests to NotCupid, operated by Lemon Labs.',
};

export default function LawEnforcementPage() {
  return (
    <LegalPage title="Law Enforcement Requests" subtitle="Our process for reviewing requests and protecting member information." updated="September 27, 2026">
      <p>NotCupid is operated by <strong>Lemon Labs</strong>. Requests are reviewed manually by the operator through the support inbox. We verify the requesting authority and legal basis before disclosing member information. A request alone does not authorize disclosure.</p>

      <h2>Where to send a request</h2>
      <p>Email <a href="mailto:match@notcupid.com?subject=Law%20Enforcement%20Request">match@notcupid.com</a> with <strong>Law Enforcement Request</strong> in the subject. Use an official agency email address. Email submission does not waive any applicable formal service requirements.</p>
      <p><strong>Lemon Labs, operator of NotCupid</strong><br />109 California Ave<br />Quincy, MA 02169, United States</p>

      <h2>Information to include</h2>
      <ul>
        <li>Your agency, officer name and title, official email, telephone number, and case or reference number.</li>
        <li>The relevant legal documents, issuing authority, legal basis, and response deadline.</li>
        <li>Specific account identifiers, such as an account email or profile URL. A display name alone may not identify an account.</li>
        <li>The categories of records requested and a clearly defined date range, including the time zone.</li>
        <li>Any applicable nondisclosure order or other restriction on notifying the account holder.</li>
      </ul>

      <h2>Verification and disclosure review</h2>
      <p>We verify identity and authority, including through independently obtained agency contact details when needed, and review the legal process, jurisdiction, scope, and requested records. We may seek clarification, request narrower scope, or obtain legal advice before responding. An official-looking email alone is not sufficient verification.</p>
      <p>Disclosure requires valid legal process appropriate to the information sought, or another applicable lawful basis, including a legally permitted emergency disclosure. We limit disclosure to the information appropriate to that basis and scope. We do not provide unrestricted account or database access. We document requests and our response decisions and arrange an appropriate secure delivery method for any disclosure.</p>

      <h2>Preservation requests</h2>
      <p>Identify a preservation request explicitly and include the accounts, records, date range, and legal authority. We review valid requests to preserve existing records in our possession as required by applicable law, pending appropriate legal process. Preservation is separate from disclosure and does not itself authorize release of records. We cannot guarantee recovery of deleted information or provide records we do not hold.</p>

      <h2>Emergency requests</h2>
      <p><strong>If someone is in immediate danger, call 911 or the appropriate local emergency service. This inbox is not monitored continuously and is not an emergency-response service.</strong></p>
      <p>Law enforcement requesting emergency disclosure should use the subject <strong>Emergency Law Enforcement Request</strong> and explain the risk of death or serious physical injury, why disclosure cannot wait for ordinary legal process, the relevant accounts, the specific information needed, and how it relates to the emergency. Include an official callback number. We assess the request under applicable law; submission does not guarantee disclosure or a response within a particular time.</p>

      <h2>Notification to members</h2>
      <p>We assess whether to notify affected members where legally permitted and appropriate. Notice may be withheld or delayed where prohibited by law or a valid order, or where notification could create a safety risk or otherwise be inappropriate in the circumstances. We document that assessment.</p>

      <h2>Member support and privacy</h2>
      <p>Members can report safety concerns in the app or email <a href="mailto:match@notcupid.com">match@notcupid.com</a>. These guidelines do not give other members access to someone else&apos;s private information. See our <a href="/privacy">Privacy Policy</a>, <a href="/terms">Terms of Service</a>, and <a href="/safety">Safety Guidelines</a>.</p>
    </LegalPage>
  );
}
