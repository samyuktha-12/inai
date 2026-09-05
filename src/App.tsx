import { useState } from 'react';
import Hero from './components/Hero';
import DemoApp from './components/DemoApp';

function App() {
  const [view, setView] = useState<'hero' | 'app'>('hero');

  return view === 'hero' ? (
    <Hero onGetStarted={() => setView('app')} />
  ) : (
    <DemoApp onBack={() => setView('hero')} />
  );
}

export default App;
