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
                <div style="flex:1;height:2px;background:#ede9ff">
                  <div style="height:100%;background:#8b7fd4;width:${pct}%"></div>
                </div>
                <span style="font-family:monospace;font-size:.7rem;color:#7a7590;width:35px;text-align:right">${pct}%</span>
              </div>
            `
          }).join('')

          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'NotCupid <match@notcupid.com>',
              to: [user.email],
              subject: 'Your full HEXACO profile — unlocked',
              html: `
                <div style="font-family:monospace;max-width:520px;margin:0 auto;padding:2rem;background:#f8f5ff;">
                  <div style="font-size:1.4rem;font-weight:700;letter-spacing:.1em;color:#0e0c1a;margin-bottom:2rem">NOTCUPID</div>
                  <p style="font-size:.7rem;color:#8b7fd4;letter-spacing:.18em;text-transform:uppercase;margin-bottom:1rem">Your HEXACO profile — unlocked</p>
                  <h2 style="font-family:monospace;font-size:1.4rem;font-weight:700;color:#0e0c1a;margin-bottom:.5rem">${user.archetype}</h2>
                  <p style="font-size:.82rem;color:#7a7590;line-height:1.7;margin-bottom:2rem">Here are all six dimensions of your personality. The algorithm used these to find your match.</p>
                  <div style="background:#fff;border:1px solid #c8c4dc;padding:1.5rem;margin-bottom:1.5rem">
                    ${dimRows}
                  </div>
                  <p style="font-size:.78rem;color:#7a7590;line-height:1.7;margin-bottom:1.5rem">
                    Your top dimensions are what drive compatibility matching. Honesty and Openness are weighted most heavily — they predict long-term connection better than any other trait.
                  </p>
                  <a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?id=${userId}" style="display:inline-block;background:#0e0c1a;color:#f8f5ff;padding:.85rem 1.75rem;font-family:monospace;font-size:.65rem;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;margin-bottom:2rem">
                    View your dashboard →
                  </a>
                  <div style="padding-top:1.5rem;border-top:1px solid #ede9ff;font-size:.65rem;color:#c8c4dc;letter-spacing:.1em;text-transform:uppercase">
                    Boston only · notcupid.com · the algo decided
                  </div>
                </div>
              `
            })
          })
          console.log('HEXACO unlock email sent to', user.email)
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Webhook error' }, { status: 400 })
  }
}
