import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const event = JSON.parse(body)

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const userId = session.metadata?.userId

      if (userId) {
        await supabaseAdmin
          .from('users')
          .update({ hexaco_unlocked: true })
          .eq('id', userId)

        await supabaseAdmin.from('unlocks').insert([{
          user_id: userId,
          stripe_payment_id: session.payment_intent,
          amount: 99
        }])
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Webhook error' }, { status: 400 })
  }
}
