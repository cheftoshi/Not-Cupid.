import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { recordUnlock } from '@/lib/record-unlock'
import { verifyStripeSignature } from '@/lib/stripe-webhook'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()

    // Verify Stripe signature BEFORE parsing or trusting any data.
    const verifyResult = verifyStripeSignature({
      rawBody: body,
      signatureHeader: req.headers.get('stripe-signature'),
      secret: process.env.STRIPE_WEBHOOK_SECRET || '',
    })
    if (!verifyResult.ok) {
      console.error('Stripe webhook signature invalid:', verifyResult.reason)
      return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
    }

    const event = JSON.parse(body)
    console.log('Webhook received:', event.type, event.id)

    // Idempotency: short-circuit if we've already processed this event.
    if (event.id) {
      const { data: seen } = await supabaseAdmin
        .from('stripe_events')
        .select('event_id')
        .eq('event_id', event.id)
        .maybeSingle()
      if (seen) {
        console.log('Duplicate Stripe event, skipping:', event.id)
        return NextResponse.json({ received: true, duplicate: true })
      }
      await supabaseAdmin
        .from('stripe_events')
        .insert({ event_id: event.id, type: event.type })
        .then(() => {})
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const userId = session.metadata?.userId
      const paymentIntent = session.payment_intent

      // ============== Handle match unlock ($0.99 HEXACO / $1.99 profile) ==============
      if (session.metadata?.type === 'match_unlock') {
        const tier = session.metadata?.unlock_tier === 'hexaco' ? 'hexaco' : 'profile'
        const error = await recordUnlock({
          userId: session.metadata.user_id,
          matchId: session.metadata.match_id,
          unlockedUserId: session.metadata.unlocked_user_id,
          tier,
          paymentId: paymentIntent,
        })
        if (error) console.error('Match unlock insert error:', error)
        else console.log(`Match unlock recorded (${tier})`)
        return NextResponse.json({ received: true })
      }
      // ============== End match unlock ==============

      // ============== Friend Maxxin — per-crew $0.99 chat unlock ==============
      if (session.metadata?.type === 'friend_crew_unlock' && session.metadata?.user_id && session.metadata?.circle_id) {
        const { error } = await supabaseAdmin.from('friend_chat_unlocks').upsert(
          { user_id: session.metadata.user_id, circle_id: session.metadata.circle_id, stripe_payment_id: session.payment_intent },
          { onConflict: 'user_id,circle_id' }
        )
        if (error) console.error('Friend crew unlock error:', error)
        else console.log('Friend crew unlock recorded')
        return NextResponse.json({ received: true })
      }

      // ============== Friend Maxxin — Pro subscription started ==============
      if (session.metadata?.type === 'friend_pro' && session.metadata?.user_id) {
        // Grant a month immediately; renewals extend it via invoice.payment_succeeded.
        const until = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString()
        const { error } = await supabaseAdmin.from('users').update({
          friend_pro_until: until,
          stripe_customer_id: session.customer || null,
          friend_sub_id: session.subscription || null,
        }).eq('id', session.metadata.user_id)
        if (error) console.error('Friend pro start error:', error)
        else console.log('Friend Pro subscription started')
        return NextResponse.json({ received: true })
      }

      console.log('Payment completed for userId:', userId)

      if (userId) {
        const { error: userError } = await supabaseAdmin
          .from('users')
          .update({ hexaco_unlocked: true })
          .eq('id', userId)
        if (userError) console.error('User update error:', JSON.stringify(userError))
        else console.log('User unlocked successfully')

        const { error: unlockError } = await supabaseAdmin
          .from('unlocks')
          .insert([{ user_id: userId, stripe_payment_id: paymentIntent, amount: 99 }])
        if (unlockError) console.error('Unlock insert error:', JSON.stringify(unlockError))
        else console.log('Unlock record created')

        const { data: user } = await supabaseAdmin
          .from('users').select('*').eq('id', userId).single()

        if (user) {
          const MAX = 12
          const dims = [
            { name: 'Honesty-Humility', val: user.score_honesty },
            { name: 'Emotionality', val: user.score_emotionality },
            { name: 'Extraversion', val: user.score_extraversion },
            { name: 'Agreeableness', val: user.score_agreeableness },
            { name: 'Conscientiousness', val: user.score_conscientiousness },
            { name: 'Openness', val: user.score_openness },
          ]
          const dimRows = dims.map(d => {
            const pct = Math.round((d.val / MAX) * 100)
            return `
              <div style="display:flex;align-items:center;gap:1rem;margin-bottom:.75rem">
                <span style="font-family:monospace;font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:#7a7590;width:140px;flex-shrink:0">${d.name}</span>
                <div style="flex:1;height:2px;background:#e8edff">
                  <div style="height:100%;background:#2563ff;width:${pct}%"></div>
                </div>
                <span style="font-family:monospace;font-size:.7rem;color:#7a7590;width:35px;text-align:right">${pct}%</span>
              </div>
            `
          }).join('')

          const emailHtml = `
            <div style="max-width:560px;margin:0 auto;padding:2.5rem 1.5rem;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f6f6f6;color:#0a0a0a">
              <div style="background:#fff;padding:2.5rem 2rem;border-radius:4px">
                <div style="font-family:monospace;font-size:.6875rem;text-transform:uppercase;letter-spacing:.18em;color:#7a7590;margin-bottom:1.5rem">
                  notcupid · personality results
                </div>
                <h1 style="font-family:Georgia,serif;font-style:italic;font-size:2rem;font-weight:400;margin:0 0 .5rem;line-height:1.2">
                  ${user.archetype || 'your personality'}
                </h1>
                <p style="color:#6b6975;font-size:.9375rem;line-height:1.6;margin:0 0 2rem">
                  hi ${user.name || 'there'} — here's your hexaco breakdown. these six dimensions shape how we match you with other bostonians.
                </p>
                <div style="margin:2rem 0">
                  ${dimRows}
                </div>
                <p style="color:#6b6975;font-size:.875rem;line-height:1.6;margin:2rem 0 0">
                  sit tight — we'll send you your match when we find someone who complements your profile.
                </p>
                <div style="border-top:1px solid #e8edff;margin-top:2rem;padding-top:1.5rem;font-family:monospace;font-size:.6875rem;text-transform:uppercase;letter-spacing:.18em;color:#a8a3b8">
                  notcupid.com
                </div>
              </div>
            </div>
          `

          const emailRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'NotCupid <match@notcupid.com>',
              to: user.email,
              subject: `your hexaco results · ${user.archetype || 'NotCupid'}`,
              html: emailHtml,
            }),
          })

          if (!emailRes.ok) {
            const errText = await emailRes.text()
            console.error('Email send failed:', errText)
          } else {
            console.log('Results email sent to', user.email)
          }
        }
      }
    }

    // ============== Friend Pro — monthly renewal extends access ==============
    if (event.type === 'invoice.payment_succeeded') {
      const inv = event.data.object
      const subId = inv.subscription
      if (subId) {
        // period end is on the invoice line; fall back to +31d.
        const periodEnd = inv.lines?.data?.[0]?.period?.end
        const until = periodEnd ? new Date(periodEnd * 1000).toISOString() : new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString()
        await supabaseAdmin.from('users').update({ friend_pro_until: until }).eq('friend_sub_id', subId)
        console.log('Friend Pro renewed to', until)
      }
    }

    // ============== Friend Pro — canceled: let access lapse at period end ==============
    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object
      // Keep friend_pro_until as-is (they keep access until the paid period ends),
      // but clear the sub id so renewals stop matching.
      await supabaseAdmin.from('users').update({ friend_sub_id: null }).eq('friend_sub_id', sub.id)
      console.log('Friend Pro subscription canceled:', sub.id)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
