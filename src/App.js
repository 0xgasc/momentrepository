import React, { useState, memo } from 'react';
import { AuthProvider, useAuth } from './components/Auth/AuthProvider';

// Import the extracted components
import CacheStatusDisplay from './components/Cache/CacheStatusDisplay';
import PerformanceList from './components/Performance/PerformanceList';
import SongBrowser from './components/Song/SongBrowser';
import SongDetail from './components/Song/SongDetail';
import PerformanceDetail from './components/Performance/PerformanceDetail';
import MomentBrowser from './components/Moment/MomentBrowser';
import LoginModal from './components/Auth/LoginModal';
import CreditsFooter from './components/UI/CreditsFooter';

import { WagmiProvider, createConfig, http } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { baseSepolia, base } from 'wagmi/chains';
import { metaMask, coinbaseWallet } from 'wagmi/connectors';

const wagmiConfig = createConfig({
  chains: [baseSepolia, base],
  connectors: [
    metaMask(),
    coinbaseWallet({
      appName: 'UMO Repository',
    }),
  ],
  transports: {
    [baseSepolia.id]: http(),
    [base.id]: http(),
  },
});
// ✅ FIXED: Create QueryClient for TanStack React Query
const queryClient = new QueryClient();

// Main App Component with Clean Navigation
const MainApp = memo(() => {
  // View state management
  const [currentView, setCurrentView] = useState('home');
  const [browseMode, setBrowseMode] = useState('performances');
  const [selectedSong, setSelectedSong] = useState(null);
  const [selectedPerformance, setSelectedPerformance] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  
  const { user, logout, loading } = useAuth();


  // Navigation handlers
  const handleSongBrowseSelect = (songData) => {
    console.log('Selected song data:', songData);
    setSelectedSong(songData);
    setCurrentView('song');
  };

  const handlePerformanceSelect = (performance) => {
    console.log('Selected performance:', performance);
    setSelectedPerformance(performance);
    setCurrentView('performance');
  };

  const handleBackToHome = () => {
    setCurrentView('home');
    setSelectedSong(null);
    setSelectedPerformance(null);
  };

  const switchBrowseMode = (mode) => {
    setBrowseMode(mode);
    setSelectedSong(null);
    setSelectedPerformance(null);
    setCurrentView('home');
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl flex items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
          Loading UMO Repository...
        </div>
      </div>
    );
  }

  // Login modal overlay
  if (showLogin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg">
          <LoginModal onClose={() => setShowLogin(false)} />
          <div className="p-4 border-t">
            <button
              onClick={() => setShowLogin(false)}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Continue Browsing Without Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 max-w-7xl mx-auto">
        {/* Header with Navigation */}
        <Header 
          user={user}
          logout={logout}
          onLoginClick={() => setShowLogin(true)}
          currentView={currentView}
          browseMode={browseMode}
          onBrowseModeChange={switchBrowseMode}
          onHomeClick={handleBackToHome}
        />


        {/* Cache Status */}
        <CacheStatusDisplay />

        {/* Main Content */}
        <MainContent 
          currentView={currentView}
          browseMode={browseMode}
          selectedSong={selectedSong}
          selectedPerformance={selectedPerformance}
          onPerformanceSelect={handlePerformanceSelect}
          onSongSelect={handleSongBrowseSelect}
          onBack={handleBackToHome}
        />

        {/* Credits Footer */}
        <CreditsFooter />
      </div>
    </div>
  );
});

MainApp.displayName = 'MainApp';

// Mobile-Optimized Header Component
const Header = memo(({ 
  user, 
  logout, 
  onLoginClick, 
  currentView, 
  browseMode, 
  onBrowseModeChange, 
  onHomeClick 
}) => (
  <div className="mb-6">
    {/* Top Row - Title and Login */}
    <div className="flex items-start justify-between mb-4">
      {/* Title Section */}
      <div className="flex-1 min-w-0">
        <button onClick={onHomeClick} className="block mb-2">
          <h1 className="text-lg sm:text-xl font-bold text-blue-600 hover:text-blue-800 transition-colors leading-tight">
            UMO - the best band in the world
          </h1>
        </button>
        <p className="text-sm text-gray-600 leading-relaxed pr-4">
          Explore UMO's entire performance history, search by city or venue, and upload your own moments from concerts.
        </p>
      </div>
      
      {/* Login Button - Top Right */}
      <div className="flex-shrink-0 ml-2">
        {user ? (
          <div className="text-right">
            <div className="text-xs text-gray-600 mb-1 truncate max-w-24">
              {user.displayName}
            </div>
            <button
              onClick={logout}
              className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        ) : (
          <div className="text-right">
            <div className="text-xs text-gray-500 mb-1">Browse read-only</div>
            <button
              onClick={onLoginClick}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              Login to Upload
            </button>
          </div>
        )}
      </div>
    </div>

    {/* Bottom Row - Navigation Tabs (only on home view) */}
    {currentView === 'home' && (
      <div className="flex justify-center">
        <div className="bg-white rounded-xl border border-gray-200 p-1 inline-flex shadow-sm w-full max-w-lg">
          <button
            onClick={() => onBrowseModeChange('performances')}
            className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              browseMode === 'performances' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <span className="mr-1">🎸</span>
            Shows
          </button>
          <button
            onClick={() => onBrowseModeChange('songs')}
            className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              browseMode === 'songs' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <span className="mr-1">🎵</span>
            Songs
          </button>
          <button
            onClick={() => onBrowseModeChange('moments')}
            className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              browseMode === 'moments' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <span className="mr-1">⚡</span>
            Moments
          </button>
        </div>
      </div>
    )}
  </div>
));

Header.displayName = 'Header';

// Main Content Router Component
const MainContent = memo(({ 
  currentView, 
  browseMode, 
  selectedSong, 
  selectedPerformance,
  onPerformanceSelect,
  onSongSelect,
  onBack
}) => {
  switch (currentView) {
    case 'song':
      return selectedSong ? (
        <SongDetail 
          songData={selectedSong} 
          onBack={onBack} 
          onPerformanceSelect={onPerformanceSelect}
        />
      ) : null;
      
    case 'performance':
      return selectedPerformance ? (
        <PerformanceDetail performance={selectedPerformance} onBack={onBack} />
      ) : null;
      
    case 'home':
    default:
      switch (browseMode) {
        case 'performances':
          return <PerformanceList onPerformanceSelect={onPerformanceSelect} />;
        case 'songs':
          return <SongBrowser onSongSelect={onSongSelect} />;
        case 'moments':
          return <MomentBrowser onSongSelect={onSongSelect} onPerformanceSelect={onPerformanceSelect} />;
        default:
          return <PerformanceList onPerformanceSelect={onPerformanceSelect} />;
      }
  }
});

MainContent.displayName = 'MainContent';

// ✅ FIXED: Main App Export with proper providers
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <AuthProvider>
          <MainApp />
        </AuthProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}