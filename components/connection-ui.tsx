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
  const copy = tone === 'love' ? 'love line' : tone === 'friend' ? 'friend line' : tone === 'profile' ? 'profile' : 'notcupid';

  return (
    <div className={`${styles.sigil} ${styles[`sigil${tone}`]}`} aria-label={label}>
      <span>{copy}</span>
      {tone === 'mixed' && <b>connection experiment</b>}
    </div>
  );
}
