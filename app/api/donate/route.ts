import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { amount } = await req.json()
    if (!amount || amount < 1) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })

    const amountCents = Math.round(parseFloat(amount) * 100)

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'payment_method_types[]': 'card',
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][product_data][name]': 'Boston Singles Fund 🎉',
        'line_items[0][price_data][product_data][description]': 'Funding the Boston Singles Party — Summer 2025. All proceeds go to the event.',
        'line_items[0][price_data][unit_amount]': amountCents.toString(),
        'line_items[0][quantity]': '1',
        'mode': 'payment',
        'success_url': `${process.env.NEXT_PUBLIC_SITE_URL}/?donated=true`,
        'cancel_url': `${process.env.NEXT_PUBLIC_SITE_URL}/`,
      })
    })

    const session = await res.json()
    if (!res.ok) return NextResponse.json({ error: 'Failed to create checkout' }, { status: 500 })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Donate error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
