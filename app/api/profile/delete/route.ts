import { NextResponse } from 'next/server';
import { getCurrentUser, destroySession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { cancelStripeSubscription } from '@/lib/subscription-management';
import { removeAccountMedia } from '@/lib/account-media-cleanup';

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: deactivated, error } = await supabaseAdmin.rpc('deactivate_notcupid_account', {
    p_user_id: user.id,
  });
  if (error || deactivated !== true) {
    console.error('[profile-delete] deactivation failed', { code: error?.code });
    return NextResponse.json({ error: 'Could not delete your account. Please try again.' }, { status: 500 });
  }

  // Read after the locked deactivation: a racing webhook cannot attach a new subscription.
  const {data:billing,error:billingError}=await supabaseAdmin.from('users').select('friend_sub_id').eq('id',user.id).single();
  const subscription=billing?.friend_sub_id || user.friend_sub_id;
  const billingCancelled=!subscription || await cancelStripeSubscription(subscription);
  if(!billingCancelled || billingError) console.error('[profile-delete] billing cancellation needs retry',{userId:user.id,code:'subscription_cancel_pending'});
  let mediaRemoved=true;
  try {await removeAccountMedia(user.id);} catch {
    mediaRemoved=false;
    console.error('[profile-delete] storage cleanup needs retry',{userId:user.id,code:'account_media_cleanup_pending'});
  }
  await destroySession();

  return NextResponse.json({ success: true, cleanupPending:!billingCancelled || !!billingError || !mediaRemoved }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
