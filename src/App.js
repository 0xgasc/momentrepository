import React, { useState, memo } from 'react';
import { AuthProvider, useAuth } from './components/Auth/AuthProvider';

// Import the extracted components (we'll create these next)
import CacheStatusDisplay from './components/Cache/CacheStatusDisplay';
import PerformanceList from './components/Performance/PerformanceList';
import SongBrowser from './components/Song/SongBrowser';
import SongDetail from './components/Song/SongDetail';
import PerformanceDetail from './components/Performance/PerformanceDetail';
import LoginModal from './components/Auth/LoginModal';
import CreditsFooter from './components/UI/CreditsFooter';

// Main App Component with Clean Navigation
const MainApp = memo(() => {
  // View state management
  const [currentView, setCurrentView] = useState('home');
  const [browseMode, setBrowseMode] = useState('performances');
  const [selectedSong, setSelectedSong] = useState(null);
  const [selectedPerformance, setSelectedPerformance] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  
  const { user, logout, loading } = useAuth();

  // MOBILE DEBUG FUNCTION - ADD THIS FIRST
  const testAPI = async () => {
    const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:5050'  
      : `http://${window.location.hostname}:5050`;
      
    console.log('🔍 Testing API:', API_BASE_URL);
    console.log('🔍 Current hostname:', window.location.hostname);
    console.log('🔍 Full URL:', window.location.href);
    
    try {
      const response = await fetch(`${API_BASE_URL}/cache/status`);
      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', [...response.headers.entries()]);
      
      const data = await response.json();
      console.log('✅ API Test Success:', data);
      alert('API Test Success! Check console for details.');
    } catch (error) {
      console.error('❌ API Test Failed:', error);
      alert('API Test Failed: ' + error.message + '\nCheck console for details.');
    }
  };

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

        {/* MOBILE DEBUG SECTION - TEMPORARY */}
        <div className="mb-4 p-4 bg-yellow-100 border-2 border-yellow-400 rounded-lg">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-sm font-medium text-yellow-800 mb-1">🧪 Mobile Debug Test</p>
              <p className="text-xs text-yellow-700">Test API connection and check console logs</p>
            </div>
            <button 
              onClick={testAPI}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors font-medium"
            >
              Test API Connection
            </button>
          </div>
        </div>

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
        <div className="bg-white rounded-xl border border-gray-200 p-1 inline-flex shadow-sm w-full max-w-sm">
          <button
            onClick={() => onBrowseModeChange('performances')}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              browseMode === 'performances' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <span className="mr-2">🎸</span>
            Performances
          </button>
          <button
            onClick={() => onBrowseModeChange('songs')}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              browseMode === 'songs' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <span className="mr-2">🎵</span>
            Songs
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