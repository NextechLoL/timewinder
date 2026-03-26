import { useCallback, useSyncExternalStore } from 'react';
import type { Region } from './data/types';
import { SnapshotView } from './components/snapshot/SnapshotView';
import { HistoricalView } from './components/historical/HistoricalView';
import { ErrorBoundary } from './components/ErrorBoundary';

type ViewTab = 'snapshot' | 'historical';

interface HashState {
  view: ViewTab;
  region: Region;
}

function parseHash(): HashState {
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);
  return {
    view: params.get('view') === 'snapshot' ? 'snapshot' : 'historical',
    region: params.get('region') === 'EU' ? 'EU' : 'NA',
  };
}

let cachedHash = '';
let cachedState: HashState = parseHash();

function getHashSnapshot(): HashState {
  const currentHash = window.location.hash;
  if (currentHash !== cachedHash) {
    cachedHash = currentHash;
    cachedState = parseHash();
  }
  return cachedState;
}

function subscribeToHash(callback: () => void) {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}

// Stable reference for SSR fallback
const serverSnapshot: HashState = { view: 'historical', region: 'NA' };

function useHashState() {
  const state = useSyncExternalStore(subscribeToHash, getHashSnapshot, () => serverSnapshot);

  const setView = useCallback((view: ViewTab) => {
    window.location.hash = `view=${view}&region=${state.region}`;
  }, [state.region]);

  const setRegion = useCallback((region: Region) => {
    window.location.hash = `view=${state.view}&region=${region}`;
  }, [state.view]);

  return { ...state, setView, setRegion };
}

export function App() {
  const { view, region, setView, setRegion } = useHashState();

  return (
    <>
      <nav className="nav">
        <div className="nav-title-row">
          <span className="nav-title nav-title-left">Nextech</span>
          <svg className="nav-logo-svg" viewBox="0 0 129 272" xmlns="http://www.w3.org/2000/svg">
            <path d="M 106.0,44.0 L 106.0,227.0 L 128.0,227.0 L 128.0,44.0 Z M 0.0,44.0 L 0.0,227.0 L 22.0,227.0 L 22.0,44.0 Z M 53.0,0.0 L 53.0,271.0 L 75.0,271.0 L 75.0,0.0 Z" fill="currentColor" fillRule="evenodd"/>
          </svg>
          <span className="nav-title nav-title-right">Timewinder</span>
        </div>
        <div className="nav-region-row">
          <button
            className={`nav-region-btn${region === 'NA' ? ' active' : ''}`}
            onClick={() => setRegion('NA')}
          >
            NA
          </button>
          <button
            className={`nav-region-btn${region === 'EU' ? ' active' : ''}`}
            onClick={() => setRegion('EU')}
          >
            EU
          </button>
        </div>
      </nav>

      <div className="container">
        <div className="view-tabs">
          <button
            className={`view-tab${view === 'historical' ? ' active' : ''}`}
            onClick={() => setView('historical')}
          >
            Historical
          </button>
          <span className="view-tab-pipe">|</span>
          <button
            className={`view-tab${view === 'snapshot' ? ' active' : ''}`}
            onClick={() => setView('snapshot')}
          >
            Snapshot
          </button>
        </div>

        <ErrorBoundary>
          {view === 'snapshot' ? (
            <SnapshotView region={region} />
          ) : (
            <HistoricalView region={region} />
          )}
        </ErrorBoundary>
      </div>
    </>
  );
}
