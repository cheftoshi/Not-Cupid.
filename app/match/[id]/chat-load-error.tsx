'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export default function ChatLoadError() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <main style={{ padding: '3rem 1.5rem', maxWidth: 520, margin: 'auto' }}>
      <h1>We couldn’t load this conversation.</h1>
      <p role="alert">Your chat hasn’t been cleared. Please retry loading your messages.</p>
      <button disabled={pending} onClick={() => startTransition(() => router.refresh())}>
        {pending ? 'Loading…' : 'Retry conversation'}
      </button>
      <p><a href="/dashboard">Back to Love Line</a></p>
    </main>
  );
}
