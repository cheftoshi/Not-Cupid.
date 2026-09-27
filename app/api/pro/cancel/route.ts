import {NextResponse} from 'next/server';
import {getCurrentUser} from '@/lib/auth';
import {rateLimit} from '@/lib/rate-limit';
import {cancelStripeRenewal} from '@/lib/subscription-management';

export async function POST() {
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  if(user.is_test || !user.friend_sub_id)return NextResponse.json({error:'No active subscription is linked.'},{status:409});
  const limit=await rateLimit({key:`cancel-pro:${user.id}`,windowSec:600,maxAttempts:10,blockSec:600});
  if(!limit.ok)return NextResponse.json({error:'Please wait before trying again.'},{status:429});
  if(!await cancelStripeRenewal(user.friend_sub_id))return NextResponse.json({error:'Cancellation was not confirmed. Please retry or contact match@notcupid.com.'},{status:503});
  return NextResponse.json({ok:true,message:'Renewal cancelled. Your paid access remains until the end of the billing period.'});
}
