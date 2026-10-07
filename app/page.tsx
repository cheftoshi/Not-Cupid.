import LandingClient from './landing-client'

// The public introduction has no live counters; avoid unused database reads.
export default function Home() {
  return <LandingClient />
}
