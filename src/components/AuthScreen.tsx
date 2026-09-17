import { useRef, useState, type FormEvent } from 'react';
import { MessageSquare, Loader2, ShieldCheck, WifiOff, Tablet } from 'lucide-react';
import { describeAuthError, USERNAME_PATTERN } from '../hooks/useSession';
import styles from './AuthScreen.module.css';

type Mode = 'signin' | 'signup';

interface AuthScreenProps {
  onSignIn: (username: string, password: string) => Promise<void>;
  onSignUp: (username: string, password: string) => Promise<void>;
}

export function AuthScreen({ onSignIn, onSignUp }: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const usernameRef = useRef<HTMLInputElement>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    usernameRef.current?.focus();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;

    const name = username.trim();
    if (!USERNAME_PATTERN.test(name)) {
      setError('Usernames are 3-24 characters: letters, numbers, . _ or -');
      return;
    }
    if (password.length < 6) {
      setError('Passwords need to be at least 6 characters.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (mode === 'signup') await onSignUp(name, password);
      else await onSignIn(name, password);
    } catch (err) {
      setError(describeAuthError(err));
      setBusy(false);
    }
  };

  return (
    <main className={styles.screen}>
      {/* On an iPad in landscape this sits beside the form; in portrait it
          stacks above it. Below 1000px the whole panel is hidden so the
          keyboard never pushes the form off-screen. */}
      <section className={styles.hero} aria-hidden="true">
        <div className={styles.mark}>
          <MessageSquare size={30} strokeWidth={2.2} />
        </div>
        <h1 className={styles.heroTitle}>Aura</h1>
        <p className={styles.heroCopy}>
          Private one-to-one messaging that opens as fast as a native app —
          built for the iPad you already have.
        </p>
        <ul className={styles.points}>
          <li>
            <ShieldCheck size={18} /> Every conversation locked to its two people
          </li>
          <li>
            <WifiOff size={18} /> Keeps working when the Wi-Fi drops
          </li>
          <li>
            <Tablet size={18} /> Add to Home Screen for a full-screen app
          </li>
        </ul>
      </section>

      <section className={styles.panel}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>
              {mode === 'signin' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className={styles.cardSub}>
              {mode === 'signin'
                ? 'Sign in with the username you picked.'
                : 'Pick a username. Your friends search for you by it.'}
            </p>
          </div>

          <div className={styles.tabs} role="tablist" aria-label="Sign in or sign up">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signin'}
              className={`${styles.tab} ${mode === 'signin' ? styles.tabActive : ''}`}
              onClick={() => switchMode('signin')}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              className={`${styles.tab} ${mode === 'signup' ? styles.tabActive : ''}`}
              onClick={() => switchMode('signup')}
            >
              Sign up
            </button>
          </div>

          <form className={styles.form} onSubmit={submit} noValidate>
            <label className={styles.field}>
              <span className={styles.label}>Username</span>
              <input
                ref={usernameRef}
                className={styles.input}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="e.g. alex"
                /* iPadOS would otherwise capitalise and autocorrect the
                   handle out from under the person typing it. */
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="username"
                enterKeyHint="next"
                inputMode="text"
                maxLength={24}
                required
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Password</span>
              <input
                className={styles.input}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                enterKeyHint="go"
                required
              />
            </label>

            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}

            <button className={styles.submit} type="submit" disabled={busy}>
              {busy ? (
                <>
                  <Loader2 size={18} className={styles.spin} />
                  {mode === 'signup' ? 'Creating account…' : 'Signing in…'}
                </>
              ) : mode === 'signup' ? (
                'Create account'
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <p className={styles.footnote}>
            {mode === 'signin' ? 'New here? ' : 'Already have an account? '}
            <button
              type="button"
              className={styles.link}
              onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
            >
              {mode === 'signin' ? 'Create an account' : 'Sign in instead'}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}
