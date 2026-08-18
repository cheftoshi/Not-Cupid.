import { NextRequest, NextResponse } from 'next/server';
import { ONLY_IN_BOSTON_CAMPAIGN } from '@/lib/acquisition';

export function GET(req: NextRequest) {
  const destination = new URL(ONLY_IN_BOSTON_CAMPAIGN.landingPath, req.url);
  destination.searchParams.set('utm_source', ONLY_IN_BOSTON_CAMPAIGN.source);
  destination.searchParams.set('utm_medium', ONLY_IN_BOSTON_CAMPAIGN.medium);
  destination.searchParams.set('utm_campaign', ONLY_IN_BOSTON_CAMPAIGN.campaign);
  return NextResponse.redirect(destination, 307);
}
