import styles from './connection-ui.module.css';

type ProfileStrengthMeterProps = {
  percent: number;
  label?: string;
};

type ConnectionSigilProps = {
  tone?: 'mixed' | 'love' | 'friend' | 'profile';
  label?: string;
};

export function ProfileStrengthMeter({ percent, label = 'profile strength' }: ProfileStrengthMeterProps) {
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));

  return (
    <div className={styles.meter}>
      <div className={styles.meterTop}>
        <span>{label}</span>
        <span className={styles.meterValue}>{safePercent}%</span>
      </div>
      <div className={styles.meterTrack} aria-hidden="true">
        <div className={styles.meterFill} style={{ width: `${safePercent}%` }} />
      </div>
    </div>
  );
}

export function ConnectionSigil({ tone = 'mixed', label = 'connection field' }: ConnectionSigilProps) {
  return (
    <div className={`${styles.sigil} ${styles[`sigil${tone}`]}`} aria-label={label}>
      <span className={styles.sigilRing} />
      <span className={styles.sigilRing} />
      <span className={styles.sigilCore} />
      <span className={styles.sigilNodeA} />
      <span className={styles.sigilNodeB} />
      <span className={styles.sigilNodeC} />
    </div>
  );
}
