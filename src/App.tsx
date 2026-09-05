import { useEffect, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import Hero from './components/Hero';
import SignInModal from './components/SignInModal';
import AuthGate from './components/AuthGate';
import AppShell from './components/AppShell';

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
          <AppShell onBack={() => setView('hero')} />
        </AuthGate>
      )}
      {showSignIn && <SignInModal onClose={() => setShowSignIn(false)} />}
    </>
  );
}

export default App;
