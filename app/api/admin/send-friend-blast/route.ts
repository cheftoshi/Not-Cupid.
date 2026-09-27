import { NextResponse } from 'next/server';

const CAMPAIGN_ARCHIVED = true;

// Archived campaigns cannot be reactivated with dry/force query parameters.
export async function POST() {
  return NextResponse.json({ code: 'CAMPAIGN_ARCHIVED', archived: CAMPAIGN_ARCHIVED,
    error: 'This campaign is archived. A new campaign requires new content and send approval.' }, { status: 410 });
}
