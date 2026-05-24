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

      console.log('Payment completed for userId:', userId)

      if (userId) {
        const { error: userError } = await supabaseAdmin
          .from('users')
          .update({ hexaco_unlocked: true })
          .eq('id', userId)

        if (userError) {
          console.error('User update error:', JSON.stringify(userError))
        } else {
          console.log('User unlocked successfully')
        }

        const { error: unlockError } = await supabaseAdmin
          .from('unlocks')
          .insert([{
            user_id: userId,
            stripe_payment_id: paymentIntent,
            amount: 99
          }])

        if (unlockError) {
          console.error('Unlock insert error:', JSON.stringify(unlockError))
        } else {
          console.log('Unlock record created')
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Webhook error' }, { status: 400 })
  }
}
