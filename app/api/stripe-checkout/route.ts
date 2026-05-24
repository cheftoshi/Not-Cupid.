import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { userId, email } = await req.json()
    if (!userId || !email) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'payment_method_types[]': 'card',
        'line_items[0][price]': process.env.STRIPE_PRICE_ID!,
        'line_items[0][quantity]': '1',
        'mode': 'payment',
        'customer_email': email,
        'success_url': `${process.env.NEXT_PUBLIC_SITE_URL}/unlock?session_id={CHECKOUT_SESSION_ID}&userId=${userId}`,
        'cancel_url': `${process.env.NEXT_PUBLIC_SITE_URL}/quiz`,
        'metadata[userId]': userId,
      })
    })

    const session = await res.json()
    if (!res.ok) {
      console.error('Stripe error:', session)
      return NextResponse.json({ error: 'Failed to create checkout' }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Checkout error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
