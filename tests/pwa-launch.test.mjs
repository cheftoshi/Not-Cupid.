import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('PWA metadata and install assets cover iOS and standalone installs', () => {
  const manifest = source('app/manifest.ts');
  const layout = source('app/layout.tsx');
  assert.match(manifest, /start_url:\s*'\/hub'/);
  assert.match(manifest, /display:\s*'standalone'/);
  assert.match(manifest, /icon-192\.png/);
  assert.match(manifest, /icon-512\.png/);
  assert.match(manifest, /icon-512-maskable\.png/);
  assert.match(layout, /appleWebApp:\s*\{/);
  assert.match(layout, /capable:\s*true/);
  assert.match(layout, /viewportFit:\s*'cover'/);
  for (const path of [
    '../public/icons/icon-192.png',
    '../public/icons/icon-512.png',
    '../public/icons/icon-512-maskable.png',
    '../app/apple-icon.png',
    '../public/offline.html',
  ]) assert.equal(existsSync(new URL(path, import.meta.url)), true, `${path} should exist`);
});

test('traffic tracking separates installed PWA use with privacy-minimal context', () => {
  const tracker = source('components/page-tracker.tsx');
  const endpoint = source('app/api/track/route.ts');
  const migration = source('supabase/migrations/20260816150000_pwa_traffic_context.sql');
  const stats = source('app/api/admin-stats/route.ts');
  assert.match(tracker, /navigator as Navigator & \{ standalone\?: boolean \}/);
  assert.match(tracker, /display-mode: standalone/);
  assert.match(tracker, /deviceClass: width < 600 \? 'phone'/);
  assert.match(tracker, /captureBrowserAcquisition/);
  assert.match(endpoint, /safeDisplayMode/);
  assert.match(endpoint, /display_mode: safeDisplayMode/);
  assert.match(migration, /No model, OS, raw screen/);
  assert.match(migration, /display_mode text/);
  assert.match(stats, /pwaSessions/);
});

test('PWA performance is measured and push permission is requested in context', () => {
  const layout = source('app/layout.tsx');
  const shell = source('components/deferred-client-shell.tsx');
  const vitals = source('components/web-vitals.tsx');
  const prompt = source('components/pwa-prompt.tsx');
  assert.match(layout, /<WebVitals/);
  assert.match(layout, /<DeferredClientShell/);
  assert.match(shell, /dynamic\(\(\) => import\('@\/components\/returning-user-welcome'\)/);
  assert.match(vitals, /useReportWebVitals/);
  assert.match(prompt, /nc:show-push-prompt/);
  assert.match(prompt, /prompt_push/);
  assert.doesNotMatch(prompt, /setTimeout\(.*Notification\.requestPermission/s);
});

test('service worker keeps pages and APIs network-first while supporting install and push', () => {
  const register = source('components/sw-register.tsx');
  const worker = source('public/sw.js');
  const subscribe = source('app/api/push/subscribe/route.ts');
  const pushMigration = source('supabase/migrations/20260816014500_push_subscription_service_role.sql');
  const privateMedia = source('lib/private-media.ts');
  assert.match(register, /serviceWorker\.register\('\/sw\.js'\)/);
  assert.match(worker, /event\.request\.mode === 'navigate'/);
  assert.match(worker, /fetch\(event\.request\)\.catch/);
  assert.match(worker, /url\.pathname\.startsWith\('\/_next\/static\/'\)/);
  assert.match(worker, /showNotification/);
  assert.match(worker, /notificationclick/);
  assert.doesNotMatch(worker, /url\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(subscribe, /Subscription write failed/);
  assert.match(subscribe, /Subscription delete failed/);
  assert.match(pushMigration, /revoke all on table public\.push_subscriptions from public, anon, authenticated/i);
  assert.match(pushMigration, /grant select, insert, update, delete on table public\.push_subscriptions to service_role/i);
  assert.match(privateMedia, /if \(!user\?\.intro_video_url\) return/);
});

test('mobile experiment and onboarding flows respect safe areas and camera video previews', () => {
  const csp = source('proxy.ts');
  const experiment = source('app/raffle/raffle-client.tsx');
  const faq = source('app/dating-experiment/faq/page.tsx');
  const terms = source('app/dating-experiment/terms/page.tsx');
  const login = source('app/login/login.module.css');
  const quiz = source('app/quiz/quiz.module.css');
  const navExtras = source('components/nav-extras.tsx');
  const changelog = source('lib/changelog.ts');
  assert.match(csp, /Permissions-Policy': 'camera=\(self\), microphone=\(self\)/);
  assert.match(csp, /media-src 'self' blob: https:\/\/\*\.supabase\.co/);
  assert.match(experiment, /URL\.createObjectURL\(file\)/);
  assert.match(experiment, /safe-area-inset-top/);
  assert.match(experiment, /safe-area-inset-bottom/);
  assert.match(experiment, /minHeight:\s*44/);
  assert.match(experiment, /the live experiment status can pause entry/);
  assert.match(terms, /Owner:<\/strong> Lemon Labs/);
  assert.match(experiment, /Private admin rehearsal/);
  assert.match(experiment, /Public entries are still closed/);
  assert.match(experiment, /optional video upload/);
  assert.match(experiment, /Skip this if it is not your thing/);
  assert.match(faq, /The [^`]*second hello is completely optional/);
  assert.doesNotMatch(experiment, /until restaurant fulfillment/);
  assert.match(faq, /Food, alcoholic or non-alcoholic drinks, ordinary tax, and gratuity/);
  assert.match(faq, /amount above \$\$\{RAFFLE\.budget\}, plus transportation, parking, or valet charges/);
  assert.match(login, /min-height:\s*100dvh/);
  assert.match(login, /safe-area-inset-bottom/);
  assert.match(quiz, /min-height:\s*100dvh/);
  assert.match(quiz, /safe-area-inset-top/);
  assert.match(navExtras, /createPortal/);
  assert.match(navExtras, /nxModalToolbar/);
  assert.match(navExtras, /nxModalBody/);
  assert.match(navExtras, /100dvh/);
  assert.match(navExtras, /safe-area-inset-top/);
  assert.match(navExtras, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(navExtras, /scrollTo\(\{ top: 0 \}\)/);
  assert.match(changelog, /2026-08-18-hub-concierge-v1/);
  assert.match(changelog, /Boston Dating Experiment is underway — entries are now closed/);
});

test('Friend Scene stays inside the phone viewport and keeps every response visible', () => {
  const scene = source('app/friends/friend-hub-client.tsx');
  const css = source('app/friends/friend-hub.module.css');
  assert.match(scene, /className=\{s\.sceneMain\}/);
  assert.match(scene, /className=\{s\.activityRsvpActions\}/);
  assert.match(css, /\.fbShell \{[^}]*grid-template-columns: minmax\(0,1fr\)[^}]*min-width: 0/);
  assert.match(css, /\.fbMain, \.fbRail \{ min-width: 0; \}/);
  assert.match(css, /\.friendPageContent \{[^}]*box-sizing: border-box;[^}]*min-width: 0;[^}]*width: 100%/);
  assert.match(css, /\.sceneFilterDock \{[^}]*overflow-x: auto/);
  assert.match(css, /\.activityRsvpActions \{ display: grid; grid-template-columns: repeat\(2,minmax\(0,1fr\)\); \}/);
  assert.match(css, /\.activityRsvpButton:first-child \{ grid-column: 1 \/ -1; \}/);
});

test('phone-critical chats and app roots stay viewport-safe in the installed PWA', () => {
  const friend = source('app/friends/friend-hub-client.tsx');
  const friendCss = source('app/friends/friend-hub.module.css');
  const loveChatCss = source('app/match/[id]/chat.module.css');
  const hubCss = source('app/hub/hub-shell.module.css');
  const dashboardCss = source('app/dashboard/dashboard.module.css');
  const profileCss = source('app/profile/profile.module.css');
  const experimentProfileCss = source('app/dating-experiment/profile/experiment-profile.module.css');
  assert.match(friend, /import \{ createPortal \} from 'react-dom'/);
  assert.match(friend, /createPortal\([\s\S]*document\.body/);
  assert.match(friend, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(friend, /visualViewport\?\.addEventListener\('resize'/);
  assert.match(friend, /clubSending/);
  assert.match(friend, /role="dialog" aria-modal="true"/);
  assert.match(friendCss, /\.chatOverlay \{[^}]*width: 100vw;[^}]*height: 100dvh;[^}]*overflow: hidden/);
  assert.match(friendCss, /\.chatSheet \{[^}]*max-width: 100vw;[^}]*min-width: 0;[^}]*100dvh/);
  assert.match(friendCss, /\.chatComposer \{[^}]*min-width: 0;[^}]*width: 100%;[^}]*app-safe-right[^}]*app-safe-left/);
  assert.match(friendCss, /\.chatInput \{[^}]*width: 0;[^}]*min-width: 0;[^}]*font-size: 16px/);
  assert.match(friendCss, /\.chatBubble \{[^}]*overflow-wrap: anywhere/);
  assert.match(loveChatCss, /\.inputForm \{[^}]*width: 100%;[^}]*min-width: 0;[^}]*safe-area-inset-right[^}]*safe-area-inset-left/);
  assert.match(loveChatCss, /\.input \{[^}]*width: 0;[^}]*min-width: 0/);
  assert.match(hubCss, /\.dashWrap \{[^}]*app-safe-right[^}]*app-safe-bottom[^}]*app-safe-left[^}]*overflow-x: clip/);
  assert.match(dashboardCss, /\.page \{[\s\S]*app-safe-right[\s\S]*app-safe-left[\s\S]*overflow-x: clip/);
  assert.match(dashboardCss, /\.loveModalOverlay \{[^}]*height: 100dvh;[^}]*overflow: hidden/);
  assert.match(dashboardCss, /\.loveProfilePreviewSheet \{[^}]*display: flex;[^}]*overflow: hidden/);
  assert.match(dashboardCss, /\.loveProfilePreviewScroll \{[^}]*overflow-y: auto/);
  assert.match(dashboardCss, /\.loveProfilePreviewToolbar \{[^}]*flex: 0 0 auto/);
  assert.match(profileCss, /\.page \{[\s\S]*min-height: 100dvh[\s\S]*app-safe-right[\s\S]*app-safe-bottom[\s\S]*app-safe-left[\s\S]*overflow-x: clip/);
  assert.match(experimentProfileCss, /min-height: 100dvh/);
  assert.match(experimentProfileCss, /safe-area-inset-right/);
});
