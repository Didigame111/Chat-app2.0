import { Settings2 } from 'lucide-react';
import styles from './SetupNotice.module.css';

/**
 * Shown instead of a blank screen when no Firebase project has been wired up
 * yet — the first thing anyone cloning this repo will see.
 */
export function SetupNotice() {
  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.mark}>
          <Settings2 size={26} />
        </div>
        <h1 className={styles.title}>Almost there</h1>
        <p className={styles.copy}>
          Schoology needs a Firebase project before it can sign anyone in. Everything
          it uses — Hosting, Authentication and Cloud Firestore — is included in
          the free Spark plan, so no billing account or card is required.
        </p>
        <ol className={styles.steps}>
          <li>
            Create a project at <code>console.firebase.google.com</code>.
          </li>
          <li>
            Turn on <strong>Authentication → Email/Password</strong> and create a{' '}
            <strong>Cloud Firestore</strong> database.
          </li>
          <li>
            Add a <strong>Web app</strong>, then copy its config into a{' '}
            <code>.env</code> file (see <code>.env.example</code>).
          </li>
          <li>
            Run <code>npm run build</code> and{' '}
            <code>firebase deploy --only hosting,firestore</code>.
          </li>
        </ol>
        <p className={styles.copy}>
          The full walkthrough is in <code>DEPLOY.md</code>.
        </p>
      </div>
    </main>
  );
}
