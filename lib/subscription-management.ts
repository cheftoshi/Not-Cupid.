import 'server-only';

export async function cancelStripeRenewal(subscriptionId:string):Promise<boolean> {
  if(!/^sub_[a-zA-Z0-9]+$/.test(subscriptionId) || !process.env.STRIPE_SECRET_KEY)return false;
  try {
    const response=await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,{
      method:'POST',headers:{Authorization:`Bearer ${process.env.STRIPE_SECRET_KEY}`,'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({cancel_at_period_end:'true'}),signal:AbortSignal.timeout(10000),
    });
    return response.ok;
  } catch {return false;}
}

export async function cancelStripeSubscription(subscriptionId: string): Promise<boolean> {
  if (!/^sub_[a-zA-Z0-9]+$/.test(subscriptionId) || !process.env.STRIPE_SECRET_KEY) return false;
  try {
    const response = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: 'DELETE', headers: {Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`},
      signal: AbortSignal.timeout(10000),
    });
    // A missing subscription cannot continue billing this account.
    return response.ok || response.status === 404;
  } catch { return false; }
}

export async function stripePortal(customerId: string, returnUrl: string): Promise<string | null> {
  if (!/^cus_[a-zA-Z0-9]+$/.test(customerId) || !process.env.STRIPE_SECRET_KEY) return null;
  const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method:'POST', headers:{Authorization:`Bearer ${process.env.STRIPE_SECRET_KEY}`,'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({customer:customerId,return_url:returnUrl}), signal:AbortSignal.timeout(10000),
  });
  if (!response.ok) return null;
  const body=await response.json();
  return typeof body.url==='string' && body.url.startsWith('https://billing.stripe.com/') ? body.url : null;
}
