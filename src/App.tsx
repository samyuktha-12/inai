import { useEffect, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import Hero from './components/Hero';
import SignInModal from './components/SignInModal';
import AuthGate from './components/AuthGate';
import AppShell from './components/AppShell';
import WeddingPortfolio from './components/WeddingPortfolio';

function WeddingSurface() {
  const [activeWeddingId, setActiveWeddingId] = useState<bigint | null>(null);
  if (activeWeddingId === null) return <WeddingPortfolio onOpenWedding={setActiveWeddingId} />;
  return <AppShell weddingId={activeWeddingId} onBack={() => setActiveWeddingId(null)} />;
}

const VIEW_KEY = 'inai-view';

function initialView(): 'hero' | 'app' {
  if (window.location.search.includes('code=')) return 'app';
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
    if (invite) localStorage.setItem('inai-invite', invite);
  }, []);

  const handleGetStarted = () => {
    if (auth.isAuthenticated) {
      setView('app');
    } else {
      setShowSignIn(true);
    }
  };

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
