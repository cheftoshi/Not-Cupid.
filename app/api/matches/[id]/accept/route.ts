import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { acceptMatch } from '@/lib/match-actions';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Same activation path as the email link: sets accepted, nudges the other on
  // first accept, fully activates (status + 24h chat window + it's-a-match
  // emails) on mutual accept.
  const { id } = await params;
  const result = await acceptMatch(id, user.id);

  if (!result.ok) {
    const code = result.reason === 'not_found' ? 404
      : result.reason === 'not_party' ? 403
      : result.reason === 'at_capacity' ? 409
      : 400;
    const msg = result.reason === 'not_found' ? 'Match not found'
      : result.reason === 'not_party' ? 'Not your match'
      : result.reason === 'at_capacity' ? 'You reached the Love Line safety limit. End a connection before accepting another.'
      : 'Match already ended';
    return NextResponse.json({ error: msg }, { status: code });
  }

  return NextResponse.json({ success: true, mutual: result.mutual });
}
