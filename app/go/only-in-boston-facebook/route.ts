import { NextRequest, NextResponse } from 'next/server';
import { ONLY_IN_BOSTON_FACEBOOK_CAMPAIGN } from '@/lib/acquisition';

export function GET(req: NextRequest) {
  const campaign = ONLY_IN_BOSTON_FACEBOOK_CAMPAIGN;
  const destination = new URL(campaign.landingPath, req.url);
  destination.searchParams.set('utm_source', campaign.source);
  destination.searchParams.set('utm_medium', campaign.medium);
  destination.searchParams.set('utm_campaign', campaign.campaign);
  return NextResponse.redirect(destination, 307);
}
