import { notFound } from 'next/navigation';
export default async function Page() {
  // This harness is never served by a production build, even if a flag is set.
  if (process.env.NODE_ENV !== 'development' || process.env.FRIEND_EVENTS_PREVIEW !== '1') notFound();
  const { default: Preview } = await import('./preview');
  return <Preview/>;
}
