# NotCupid

Boston's smartest dating experiment. Not a swipe app.

## Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **CSS Modules**
- **Supabase** (coming next — database + auth)
- **Twilio** (coming next — SMS matching)
- **Stripe** (coming next — $0.99 HEXACO unlock)
- **Vercel** (deploy)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
notcupid/
├── app/
│   ├── layout.tsx          # Root layout + metadata
│   ├── page.tsx            # Landing page
│   ├── page.module.css     # Landing page styles
│   ├── globals.css         # Global CSS + design tokens
│   └── quiz/
│       ├── page.tsx        # Full quiz flow (intro → quiz → loading → result)
│       └── quiz.module.css # Quiz styles
├── components/
│   ├── Nav.tsx             # Fixed nav bar
│   └── Nav.module.css
└── lib/
    └── quiz-data.ts        # All 24 questions, HEXACO scoring, archetypes, zip validation
```

## Design Tokens

All colors live in `globals.css` as CSS variables:

```css
--bg          #f8f6f1   /* warm off-white */
--ink         #1a1814   /* near-black */
--ink-muted   #6b6760   /* secondary text */
--accent      #d94f3d   /* coral red — CTAs, highlights */
```

## Quiz Architecture

24 questions across 6 HEXACO dimensions (4 per dimension):
- **H** Honesty-Humility
- **E** Emotionality  
- **X** Extraversion
- **A** Agreeableness
- **C** Conscientiousness
- **O** Openness

Each answer scores 1–4 points. Max score per dimension: 16.

Matching uses H, O, and A as primary dimensions (within ±15pts).

## Zip Validation

Built-in zip → coordinate lookup, validated against 50-mile radius from 02116 (Back Bay, Boston).

## Next Steps

1. `npm install @supabase/supabase-js` — wire up database
2. Add Supabase schema (users, quiz_results, matches tables)
3. API route for form submission → Supabase insert
4. Twilio SMS on match
5. Stripe $0.99 HEXACO unlock

## Deploy to Vercel

```bash
# Connect GitHub repo to Vercel
# Set env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY, TWILIO_*, STRIPE_*
vercel --prod
```
