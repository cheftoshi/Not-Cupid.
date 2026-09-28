import test from 'node:test';
import assert from 'node:assert/strict';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadTs } from './helpers/load-ts.mjs';

test('public terms render billing disclosures, working section links, and business contact', async () => {
  const { default: LegalPage } = await loadTs('components/legal-page.tsx', {
    'react/jsx-runtime': jsxRuntime,
  });
  const { default: TermsPage } = await loadTs('app/terms/page.tsx', {
    'react/jsx-runtime': jsxRuntime,
    '@/components/legal-page': { default: LegalPage },
  });
  const html = renderToStaticMarkup(jsxRuntime.jsx(TermsPage, {}));
  for (const id of ['payments', 'cancellation', 'refunds', 'contact']) {
    assert.ok(html.includes(`href="#${id}"`));
    assert.ok(html.includes(`id="${id}"`));
  }
  for (const text of ['USD $0.99', 'USD $3.99 per month', 'renews automatically',
    'Cancel renewal', 'Manage subscription', 'current billing period',
    'mandatory consumer rights', 'ten-connection limit', '10 days',
    'August 2026 Boston Dating Experiment is closed', '109 California Ave',
    'Quincy, MA 02169', 'mailto:match@notcupid.com']) {
    assert.ok(html.includes(text), `Missing public disclosure: ${text}`);
  }
  assert.doesNotMatch(html, /Be cool|The legal bits|Ending things/);
});

test('law enforcement protocol is public and renders verification and emergency limits', async () => {
  const { default: LegalPage } = await loadTs('components/legal-page.tsx', {
    'react/jsx-runtime': jsxRuntime,
  });
  const { default: Page } = await loadTs('app/law-enforcement/page.tsx', {
    'react/jsx-runtime': jsxRuntime,
    '@/components/legal-page': { default: LegalPage },
  });
  const html = renderToStaticMarkup(jsxRuntime.jsx(Page, {}));
  for (const text of ['Law Enforcement Requests', 'match@notcupid.com',
    'Verification and disclosure review', 'Preservation requests',
    'Emergency requests', 'not monitored continuously', 'call 911',
    'Notification to members', '109 California Ave']) {
    assert.ok(html.includes(text), `Missing protocol content: ${text}`);
  }
  for (const href of ['/privacy', '/terms', '/safety']) {
    assert.ok(html.includes(`href="${href}"`));
  }
});
