import type { Metadata } from 'next';
import LegalPage from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'About — NotCupid',
  description: 'Who is behind NotCupid, and why we built a dating app that refuses to be one.',
};

export default function AboutPage() {
  return (
    <LegalPage title="About NotCupid" subtitle="Meet people. Not profiles.">
      <p>NotCupid is a Boston-born connection experiment with a simple bet: people are better than their profiles. So we built the anti-dating-app — no endless swiping, no browsing a catalog of strangers, no gamified attention economy.</p>

      <p>Instead, an algorithm reads compatibility from a real personality quiz and quietly shows you a small, curated roster of people you&apos;d actually get along with. You pick <strong>one</strong>. One match at a time, on purpose — the way it works when a friend introduces you to someone, not the way it works when you&apos;re doom-scrolling at midnight.</p>

      <h2>Two lines, one region</h2>
      <ul>
        <li><strong>The Love Line</strong> — for dating. Compatible people, one choice at a time, then a real conversation.</li>
        <li><strong>The Friend Line</strong> — for making actual friends as an adult, which is somehow harder than dating. Crews, group chats, and a feed of what&apos;s happening around town.</li>
      </ul>

      <h2>Started in Boston, now across the Northeast</h2>
      <p>We started in Boston — Cambridge, Somerville, the whole T map — because real-life connection is local. We&apos;ve since opened up the rest of New England — Providence, Hartford, New Haven, Portland, Burlington, Manchester — and now New York City too. Wherever you are, the algorithm only ever matches you with people in your own metro. We&apos;d rather be the best way to meet someone in your city than a mediocre one everywhere.</p>

      <h2>Who&apos;s behind it</h2>
      <p>NotCupid is built and run by <strong>Lemon Labs</strong>, an independent studio. We&apos;re a small team that actually answers its email — if you have a bug, an idea, or just want to tell us what&apos;s missing, write to <a href="mailto:match@notcupid.com">match@notcupid.com</a> and a person will read it.</p>

      <h2>Say hi</h2>
      <p>Follow along and tell your friends:</p>
      <ul>
        <li>Instagram — <a href="https://instagram.com/notcupidapp" target="_blank" rel="noopener noreferrer">@notcupidapp</a></li>
        <li>TikTok — <a href="https://tiktok.com/@notcupid11" target="_blank" rel="noopener noreferrer">@notcupid11</a></li>
        <li>X — <a href="https://x.com/notcupidapp" target="_blank" rel="noopener noreferrer">@notcupidapp</a></li>
      </ul>

      <p style={{ marginTop: '1.5rem', color: '#6b6b76', fontSize: '0.85rem' }}>The fine print: see our <a href="/privacy">Privacy Policy</a>, <a href="/terms">Terms</a>, and <a href="/safety">Safety Guidelines</a>.</p>
    </LegalPage>
  );
}
