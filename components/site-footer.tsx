'use client';

import { usePathname } from 'next/navigation';
import CorpFooter from './corp-footer';

// One permanent footer for the whole app — mounted once in the root layout.
// Hidden on the few intentionally-dark/immersive surfaces that carry their own
// footer (the cinematic friend-pack page + the dark /pro sales page).
const HIDE = ['/friends/pack', '/pro'];

export default function SiteFooter() {
  const pathname = usePathname() || '';
  if (HIDE.some((h) => pathname === h || pathname.startsWith(h + '/'))) return null;
  return <CorpFooter />;
}
