import {NextResponse} from 'next/server';
import {getCurrentUser} from '@/lib/auth';
import {rateLimit} from '@/lib/rate-limit';
import {stripePortal} from '@/lib/subscription-management';

export async function POST() {
  const user=await getCurrentUser();
  if (!user) return NextResponse.json({error:'Unauthorized'},{status:401});
  if (user.is_test || !user.stripe_customer_id) return NextResponse.json({error:'No billing account is linked to this profile.'},{status:409});
  const limit=await rateLimit({key:`billing-portal:${user.id}`,windowSec:600,maxAttempts:10,blockSec:600});
  if(!limit.ok) return NextResponse.json({error:'Please wait before trying again.'},{status:429});
  try {
    const url=await stripePortal(user.stripe_customer_id,`${process.env.NEXT_PUBLIC_SITE_URL || 'https://notcupid.com'}/pro`);
    if(url) return NextResponse.json({url});
  } catch { /* Never disclose provider secrets or raw errors. */ }
  return NextResponse.json({error:'Subscription management is temporarily unavailable. Contact match@notcupid.com for help cancelling.'},{status:503});
}
