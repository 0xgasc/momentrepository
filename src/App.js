import React, { useState, memo, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './components/Auth/AuthProvider';
import { PlatformSettingsProvider } from './contexts/PlatformSettingsContext';
import { Menu, X } from 'lucide-react';

// Import the extracted components
import CacheStatusDisplay from './components/Cache/CacheStatusDisplay';
import PerformanceList from './components/Performance/PerformanceList';
import SongBrowser from './components/Song/SongBrowser';
import SongDetail from './components/Song/SongDetail';
import PerformanceDetail from './components/Performance/PerformanceDetail';
import MomentBrowser from './components/Moment/MomentBrowser';
import LoginModal from './components/Auth/LoginModal';
import CreditsFooter from './components/UI/CreditsFooter';
import MyAccount from './components/User/MyAccount';
import AdminPanel from './components/Admin/AdminPanel';

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

const queryClient = new QueryClient();


// Main App Component with Clean Navigation
const MainApp = memo(() => {
  // View state management
  const [currentView, setCurrentView] = useState('home');
  const [browseMode, setBrowseMode] = useState('performances');
  const [selectedSong, setSelectedSong] = useState(null);
  const [selectedPerformance, setSelectedPerformance] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showMyAccount, setShowMyAccount] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  
  const { user, logout, loading } = useAuth();
  
  // Temporary debugging 
  console.log('🔍 App.js - Auth state:', { user, loading, hasUser: !!user });
  console.log('🔍 User email:', user?.email);


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
          onMyAccountClick={() => setShowMyAccount(true)}
          onAdminPanelClick={() => setShowAdminPanel(true)}
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
      
      {/* Account Panels */}
      {showMyAccount && (
        <MyAccount onClose={() => setShowMyAccount(false)} />
      )}
      
      {showAdminPanel && (
        <AdminPanel onClose={() => setShowAdminPanel(false)} />
      )}
    </div>
  );
});

MainApp.displayName = 'MainApp';

// Mobile-Optimized Header Component with Hamburger Menu
const Header = memo(({ 
  user, 
  logout, 
  onLoginClick,
  onMyAccountClick,
  onAdminPanelClick,
  currentView, 
  browseMode, 
  onBrowseModeChange, 
  onHomeClick 
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="mb-6">
      {/* Mobile Header */}
      <div className="block sm:hidden">
        <div className="flex items-center justify-between mb-4">
          {/* Logo/Title */}
          <button onClick={() => { onHomeClick(); closeMobileMenu(); }} className="flex-1 text-left">
            <h1 className="text-lg font-bold text-blue-600 leading-tight">
              UMO Archive
            </h1>
          </button>
          
          {/* Hamburger Menu Button */}
          <button
            onClick={toggleMobileMenu}
            className="p-2 text-gray-600 hover:text-gray-900 focus:outline-none"
            style={{ minHeight: '44px', minWidth: '44px' }}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-50" onClick={closeMobileMenu}>
            <div 
              className="fixed top-0 right-0 h-full w-80 bg-white shadow-lg transform transition-transform duration-300 ease-in-out"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4">
                {/* Close button */}
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-bold text-gray-900">Menu</h2>
                  <button
                    onClick={closeMobileMenu}
                    className="p-2 text-gray-600 hover:text-gray-900"
                    style={{ minHeight: '44px', minWidth: '44px' }}
                  >
                    <X size={24} />
                  </button>
                </div>

                {/* Navigation Items */}
                <div className="space-y-4 mb-6">
                  <button
                    onClick={() => { onBrowseModeChange('performances'); closeMobileMenu(); }}
                    className={`w-full text-left p-4 rounded-lg transition-colors ${
                      browseMode === 'performances' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-50 text-gray-900 hover:bg-gray-100'
                    }`}
                    style={{ minHeight: '44px' }}
                  >
                    <span className="mr-2">🎸</span>
                    Browse Shows
                  </button>
                  
                  <button
                    onClick={() => { onBrowseModeChange('songs'); closeMobileMenu(); }}
                    className={`w-full text-left p-4 rounded-lg transition-colors ${
                      browseMode === 'songs' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-50 text-gray-900 hover:bg-gray-100'
                    }`}
                    style={{ minHeight: '44px' }}
                  >
                    <span className="mr-2">🎵</span>
                    Browse Songs
                  </button>
                  
                  <button
                    onClick={() => { onBrowseModeChange('moments'); closeMobileMenu(); }}
                    className={`w-full text-left p-4 rounded-lg transition-colors ${
                      browseMode === 'moments' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-50 text-gray-900 hover:bg-gray-100'
                    }`}
                    style={{ minHeight: '44px' }}
                  >
                    <span className="mr-2">⚡</span>
                    Browse Moments
                  </button>
                </div>

                {/* Account Actions */}
                <div className="border-t pt-4 space-y-3">
                  {user ? (
                    <>
                      <div className="text-sm text-gray-600 mb-3">
                        Logged in as: <span className="font-medium">{user.displayName}</span>
                      </div>
                      
                      <button
                        onClick={() => { onMyAccountClick(); closeMobileMenu(); }}
                        className="w-full text-left p-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                        style={{ minHeight: '44px' }}
                      >
                        👤 My Account
                      </button>
                      
                      {user.email === 'solo@solo.solo' && (
                        <button
                          onClick={() => { onAdminPanelClick(); closeMobileMenu(); }}
                          className="w-full text-left p-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                          style={{ minHeight: '44px' }}
                        >
                          👑 Admin Panel
                        </button>
                      )}
                      
                      <button
                        onClick={() => { logout(); closeMobileMenu(); }}
                        className="w-full text-left p-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        style={{ minHeight: '44px' }}
                      >
                        Logout
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => { onLoginClick(); closeMobileMenu(); }}
                      className="w-full text-left p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      style={{ minHeight: '44px' }}
                    >
                      Login to Upload
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Desktop Header */}
      <div className="hidden sm:block">
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
          
          {/* Account Controls - Top Right */}
          <div className="flex-shrink-0 ml-2">
            {user ? (
              <div className="text-right space-y-2">
                <div className="text-xs text-gray-600 truncate max-w-32">
                  {user.displayName}
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={onMyAccountClick}
                    className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 transition-colors whitespace-nowrap"
                    style={{ minHeight: '36px' }}
                  >
                    👤 My Account
                  </button>
                  {user.email === 'solo@solo.solo' && (
                    <button
                      onClick={onAdminPanelClick}
                      className="px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 transition-colors whitespace-nowrap"
                      style={{ minHeight: '36px' }}
                    >
                      👑 Admin Panel
                    </button>
                  )}
                  <button
                    onClick={logout}
                    className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition-colors whitespace-nowrap"
                    style={{ minHeight: '36px' }}
                  >
                    Logout
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-right">
                <div className="text-xs text-gray-500 mb-1">Browse read-only</div>
                <button
                  onClick={onLoginClick}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors whitespace-nowrap"
                  style={{ minHeight: '36px' }}
                >
                  Login to Upload
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Desktop Navigation Tabs (only on home view) */}
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
                style={{ minHeight: '44px' }}
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
                style={{ minHeight: '44px' }}
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
                style={{ minHeight: '44px' }}
              >
                <span className="mr-1">⚡</span>
                Moments
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

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

// ✅ UPDATED: Main App Export with Web3 providers
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <PlatformSettingsProvider>
          <AuthProvider>
            <MainApp />
          </AuthProvider>
        </PlatformSettingsProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}