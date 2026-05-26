import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const event = JSON.parse(body)
    console.log('Webhook received:', event.type)

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const userId = session.metadata?.userId
      const paymentIntent = session.payment_intent

      // ============== NEW: handle $2.99 match unlock ==============
      if (session.metadata?.type === 'match_unlock') {
        const { error } = await supabaseAdmin.from('match_unlocks').upsert(
          {
            user_id: session.metadata.user_id,
            match_id: session.metadata.match_id,
            unlocked_user_id: session.metadata.unlocked_user_id,
            amount_cents: 299,
            stripe_payment_id: paymentIntent,
          },
          { onConflict: 'user_id,match_id' }
        )
        if (error) console.error('Match unlock insert error:', error)
        else console.log('Match unlock recorded')
        return NextResponse.json({ received: true })
      }
      // ============== END NEW ==============

      console.log('Payment completed for userId:', userId)
      
      // ... your existing hexaco unlock code continues unchanged from here
    }
