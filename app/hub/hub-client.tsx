import ConnectionConcierge from './connection-concierge';
import styles from './hub-shell.module.css';

export default function HubClient({
  firstName,
  city,
  conciergeConsented,
}: {
  firstName: string;
  city?: string | null;
  conciergeConsented: boolean;
}) {
  return (
    <main className={styles.hub}>
      <div className={styles.hubAtmosphere} aria-hidden />
      <div className={styles.dashWrap}>
        <ConnectionConcierge
          firstName={firstName}
          city={city}
          initialConsented={conciergeConsented}
        />
      </div>
    </main>
  );
}
