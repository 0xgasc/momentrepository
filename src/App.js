import React, { useState, memo } from 'react';
import { AuthProvider, useAuth } from './components/Auth/AuthProvider';

// Import the extracted components (we'll create these next)
import CacheStatusDisplay from './components/Cache/CacheStatusDisplay';
import PerformanceList from './components/Performance/PerformanceList';
import SongBrowser from './components/Song/SongBrowser';
import SongDetail from './components/Song/SongDetail';
import PerformanceDetail from './components/Performance/PerformanceDetail';
import LoginModal from './components/Auth/LoginModal';

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
      </div>
    </div>
  );
});

MainApp.displayName = 'MainApp';

// Clean Header Component
const Header = memo(({ 
  user, 
  logout, 
  onLoginClick, 
  currentView, 
  browseMode, 
  onBrowseModeChange, 
  onHomeClick 
}) => (
  <div className="relative mb-4">
    {/* Top Right Controls */}
    <div className="absolute top-0 right-0 flex flex-col items-end gap-3">
      {/* User Info */}
      <div className="flex items-center gap-4">
        {user ? (
          <>
            <span className="text-gray-600">Welcome, {user.displayName}!</span>
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </>
        ) : (
          <div className="text-gray-600">
            <span className="mr-3">Browse read-only</span>
            <button
              onClick={onLoginClick}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Login to Upload
            </button>
          </div>
        )}
      </div>
      
      {/* Browse Mode Toggle */}
      {currentView === 'home' && (
        <div className="bg-white rounded-lg border border-gray-200 p-1 inline-flex shadow-sm">
          <button
            onClick={() => onBrowseModeChange('performances')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              browseMode === 'performances' 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🎸 Performances
          </button>
          <button
            onClick={() => onBrowseModeChange('songs')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              browseMode === 'songs' 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🎵 Songs
          </button>
        </div>
      )}
    </div>
    
    {/* Title & Description */}
    <div className="pt-4 pr-64">
      <button onClick={onHomeClick} className="block mb-2">
        <h1 className="text-xl font-bold text-blue-600 hover:text-blue-800 transition-colors">
          UMO - the best band in the world
        </h1>
      </button>
      <p className="text-sm text-gray-600 max-w-xl leading-relaxed">
        Explore UMO's entire performance history, search by city or venue, and upload your own moments from concerts.
      </p>
    </div>
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
        <SongDetail songData={selectedSong} onBack={onBack} />
      ) : null;
      
    case 'performance':
      return selectedPerformance ? (
        <PerformanceDetail performance={selectedPerformance} onBack={onBack} />
      ) : null;
      
    case 'home':
    default:
      return browseMode === 'performances' ? (
        <PerformanceList onPerformanceSelect={onPerformanceSelect} />
      ) : (
        <SongBrowser onSongSelect={onSongSelect} />
      );
  }
});

MainContent.displayName = 'MainContent';

// Main App Export
export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}