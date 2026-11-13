import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { friendLocationContext } from '@/lib/friend-location';
import { cityEvents } from '@/lib/city-events-server';
import { recordAppEvent } from '@/lib/app-events';
import { parseOutsideInput } from '@/lib/outside-event-tracking';
import { friendEventCampaignContext } from '@/lib/friend-event-attribution';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  // No cross-origin analytics submissions or arbitrary metadata.
  if (req.headers.get('origin') && req.headers.get('origin') !== new URL(req.url).origin) return NextResponse.json({ok:false},{status:403});
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ok:false},{status:401});
  const limit = await rateLimit({key:`outside-events:${user.id}`,windowSec:60,maxAttempts:180,blockSec:60});
  if (!limit.ok) return NextResponse.json({ok:false},{status:429});
  if (Number(req.headers.get('content-length')) > 2048) return NextResponse.json({ok:false},{status:413});
  const raw = await req.text();
  if (raw.length > 2048) return NextResponse.json({ok:false},{status:413});
  let body; try { body = JSON.parse(raw); } catch { return NextResponse.json({ok:false},{status:400}); }
  const input = parseOutsideInput(body);
  if (!input) return NextResponse.json({ok:false},{status:400});
  try {
    const location = await friendLocationContext(user);
    if (!location.metro) return NextResponse.json({ok:false},{status:400});
    let category: string | null = null;
    if (input.eventId) {
      const catalog = await cityEvents(location.metro);
      if (catalog.status !== 'ready') return NextResponse.json({ok:false},{status:503});
      const event = catalog.events.find(e => e.id === input.eventId);
      if (!event) return NextResponse.json({ok:false},{status:400});
      category = event.category;
    }
    const campaign = await friendEventCampaignContext(user.id);
    const key = createHash('sha256').update(JSON.stringify([user.id,input.sessionId,location.metro,input.action,input.eventId,input.filter,input.value,campaign?.deliveryId || null])).digest('hex');
    const recorded = await recordAppEvent({userId:user.id,eventName:`outside_event_${input.action}`,surface:'outside_events',path:'/hub',sessionId:input.sessionId,dedupeKey:`outside:${key}`,metadata:{event_id:input.eventId || null,category,filter:input.filter || null,value:input.value || null,campaign_delivery_id:campaign?.deliveryId || null,campaign_channel:campaign?.channel || null}});
    return NextResponse.json({ok:recorded},{status:recorded ? 200 : 503});
  } catch { return NextResponse.json({ok:false},{status:503}); }
}
