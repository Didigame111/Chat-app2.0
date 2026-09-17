import { initialsOf } from '../lib/format';
import styles from './Avatar.module.css';

interface AvatarProps {
  name: string;
  hue?: number;
  size?: 'sm' | 'md' | 'lg';
  online?: boolean;
}

export function Avatar({ name, hue = 250, size = 'md', online }: AvatarProps) {
  return (
    <span className={`${styles.avatar} ${styles[size]}`} aria-hidden="true">
      <span
        className={styles.disc}
        style={{
          background: `linear-gradient(135deg, hsl(${hue} 72% 58%), hsl(${(hue + 40) % 360} 72% 62%))`,
        }}
      >
        {initialsOf(name)}
      </span>
      {online !== undefined && (
        <span className={`${styles.presence} ${online ? styles.on : styles.off}`} />
      )}
    </span>
  );
}
