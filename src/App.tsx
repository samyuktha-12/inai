import { useEffect, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import Hero from './components/Hero';
import SignInModal from './components/SignInModal';
import AuthGate from './components/AuthGate';
import AppShell from './components/AppShell';
import WeddingPortfolio from './components/WeddingPortfolio';
// TEMP-SCREENSHOT: bypass OIDC to capture README screenshots
import { SpacetimeDBProvider } from 'spacetimedb/react';
import { DbConnection } from './module_bindings';
const TEMP_SCREENSHOT = true;
const TEMP_HOST = import.meta.env.VITE_SPACETIMEDB_HOST ?? 'ws://localhost:3000';
const TEMP_DB = import.meta.env.VITE_SPACETIMEDB_DB_NAME ?? 'react-ts';

function WeddingSurface() {
  const [activeWeddingId, setActiveWeddingId] = useState<bigint | null>(null);
  if (activeWeddingId === null) return <WeddingPortfolio onOpenWedding={setActiveWeddingId} />;
  return <AppShell weddingId={activeWeddingId} onBack={() => setActiveWeddingId(null)} />;
}

const VIEW_KEY = 'inai-view';

function initialView(): 'hero' | 'app' {
  const params = new URLSearchParams(window.location.search);
  const invite = params.get('invite');
  if (invite) {
    // Save before AuthGate starts an OIDC redirect, since the callback URL
    // intentionally removes query parameters after sign-in.
    localStorage.setItem('inai-invite', invite);
    return 'app';
  }
  if (params.has('code')) return 'app';
  return localStorage.getItem(VIEW_KEY) === 'app' ? 'app' : 'hero';
}

function App() {
  const auth = useAuth();
  const [view, setView] = useState<'hero' | 'app'>(initialView);
  const [showSignIn, setShowSignIn] = useState(false);

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  useEffect(() => {
    const invite = new URLSearchParams(window.location.search).get('invite');
    if (invite) {
      localStorage.setItem('inai-invite', invite);
      setView('app');
    }
  }, []);

  const handleGetStarted = () => {
    if (auth.isAuthenticated) {
      setView('app');
    } else {
      setShowSignIn(true);
    }
  };

  if (TEMP_SCREENSHOT) {
    return (
      <>
        {view === 'hero' ? (
          <Hero onGetStarted={handleGetStarted} />
        ) : (
          <SpacetimeDBProvider
            connectionBuilder={DbConnection.builder().withUri(TEMP_HOST).withDatabaseName(TEMP_DB)}
          >
            <WeddingSurface />
          </SpacetimeDBProvider>
        )}
        {showSignIn && <SignInModal onClose={() => setShowSignIn(false)} />}
      </>
    );
  }

  return (
    <>
      {view === 'hero' ? (
        <Hero onGetStarted={handleGetStarted} />
      ) : (
        <AuthGate>
          <WeddingSurface />
        </AuthGate>
      )}
      {showSignIn && <SignInModal onClose={() => setShowSignIn(false)} />}
    </>
  );
}

export default App;
