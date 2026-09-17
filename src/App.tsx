import { isConfigured } from './firebase';
import { useSession } from './hooks/useSession';
import { usePageBounceLock, useViewportFit } from './hooks/useViewportFit';
import { AuthScreen } from './components/AuthScreen';
import { ChatShell } from './components/ChatShell';
import { SetupNotice } from './components/SetupNotice';

export default function App() {
  // Must run before anything measures itself against --app-height.
  useViewportFit();
  usePageBounceLock();

  if (!isConfigured) return <SetupNotice />;

  return <ConfiguredApp />;
}

function ConfiguredApp() {
  const { status, profile, signIn, signUp, signOutOfAura } = useSession();

  if (status === 'loading') {
    return (
      <div
        style={{
          display: 'grid',
          placeItems: 'center',
          height: 'var(--app-height)',
          color: 'var(--text-dim)',
        }}
      >
        Loading Aura…
      </div>
    );
  }

  if (status === 'signed-out' || !profile) {
    return <AuthScreen onSignIn={signIn} onSignUp={signUp} />;
  }

  return <ChatShell me={profile} onSignOut={() => void signOutOfAura()} />;
}
