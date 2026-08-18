'use client';

import dynamic from 'next/dynamic';
import NativeShellBootstrap from '@/components/native-shell-bootstrap';
import PageTracker from '@/components/page-tracker';
import SwRegister from '@/components/sw-register';
import OfflineBanner from '@/components/offline-banner';

const PwaPrompt = dynamic(() => import('@/components/pwa-prompt'));
const FeedbackHost = dynamic(() => import('@/components/feedback'));
const ReturningUserWelcome = dynamic(() => import('@/components/returning-user-welcome'));

export default function DeferredClientShell() {
  return (
    <>
      <NativeShellBootstrap />
      <OfflineBanner />
      <ReturningUserWelcome />
      <PwaPrompt />
      <PageTracker />
      <SwRegister />
      <FeedbackHost />
    </>
  );
}
