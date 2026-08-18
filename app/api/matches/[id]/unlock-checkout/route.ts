import { NextResponse } from 'next/server';

// Legacy endpoint kept only so old cached clients fail with an accurate answer.
// Match profiles are no longer sold; the full compatibility profile is included
// after a mutual connection. New Love monetization lives on extra outgoing picks.
export async function POST() {
  return NextResponse.json({
    error: 'Love profiles are now included after a mutual connection. There is nothing to unlock.',
  }, { status: 410 });
}
