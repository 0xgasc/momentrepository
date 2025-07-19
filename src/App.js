import React, { useState, memo } from 'react';
import { AuthProvider, useAuth } from './components/Auth/AuthProvider';
import { PlatformSettingsProvider } from './contexts/PlatformSettingsContext';
import { Menu, X, Info, ChevronDown, ChevronUp } from 'lucide-react';
import './styles/umo-theme.css';

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
import { useNotifications } from './hooks';
import { API_BASE_URL } from './components/Auth/AuthProvider';

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
  const [browseMode, setBrowseMode] = useState('moments');
  const [selectedSong, setSelectedSong] = useState(null);
  const [selectedPerformance, setSelectedPerformance] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showMyAccount, setShowMyAccount] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showHowToGuide, setShowHowToGuide] = useState(false);
  
  const { user, logout, loading } = useAuth();
  
  // Notifications hook
  const { getBadgeInfo, refreshNotifications } = useNotifications(API_BASE_URL);
  
  // Temporary debugging 
  console.log('🔍 App.js - Auth state:', { user, loading, hasUser: !!user });
  console.log('🔍 User email:', user?.email);
  console.log('🔍 User role:', user?.role);
  console.log('🔍 Admin button should show:', (user?.role === 'admin' || user?.role === 'mod' || user?.email === 'solo@solo.solo'));


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
    <div className="umo-container">
      <div className="umo-container-fluid">
        {/* Header with Navigation */}
        <Header 
          user={user}
          logout={logout}
          onLoginClick={() => setShowLogin(true)}
          onMyAccountClick={() => {
            setShowMyAccount(true);
            refreshNotifications(); // Refresh when opening My Account
          }}
          onAdminPanelClick={() => {
            setShowAdminPanel(true);
            refreshNotifications(); // Refresh when opening Admin Panel
          }}
          currentView={currentView}
          browseMode={browseMode}
          onBrowseModeChange={switchBrowseMode}
          onHomeClick={handleBackToHome}
          badgeInfo={getBadgeInfo()}
          showHowToGuide={showHowToGuide}
          onToggleHowToGuide={() => setShowHowToGuide(!showHowToGuide)}
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
        <MyAccount onClose={() => {
          setShowMyAccount(false);
          refreshNotifications(); // Refresh when closing My Account
        }} />
      )}
      
      {showAdminPanel && (
        <AdminPanel onClose={() => {
          setShowAdminPanel(false);
          refreshNotifications(); // Refresh when closing Admin Panel
        }} />
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
  onHomeClick,
  badgeInfo,
  showHowToGuide,
  onToggleHowToGuide
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="mb-6">
      {/* Mobile Header */}
      <div className="block sm:hidden">
        <div className="flex items-center justify-between mb-4 p-3 bg-white/90 backdrop-blur-sm" style={{ borderRadius: '4px', marginBottom: '1rem' }}>
          {/* Logo/Title */}
          <button 
            onClick={() => {
              onToggleHowToGuide();
              // Don't navigate home or close menu when clicking for info
            }} 
            className="flex-1 text-left flex items-center gap-2"
            title="Click for site info and how to use"
          >
            <h1 className="umo-heading umo-heading--sm text-blue-600">
              UMO - the best band in the world
            </h1>
            {showHowToGuide ? <ChevronUp size={14} className="text-blue-600" /> : <ChevronDown size={14} className="text-blue-600" />}
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

        {/* How to Guide - Mobile - Simplified */}
        {showHowToGuide && (
          <div className="mb-4 umo-card p-3">
            <h3 className="umo-heading umo-heading--sm mb-2">How to Use UMO Archive</h3>
            <p className="umo-text-secondary text-xs mb-3">
              Explore UMO's performance history and upload your concert moments.
            </p>
            
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-600">1</div>
                <div>
                  <div className="umo-text-primary text-xs font-medium">Browse & Explore</div>
                  <div className="umo-text-secondary text-xs">Use tabs to browse Moments, Shows, Songs</div>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-600">2</div>
                <div>
                  <div className="umo-text-primary text-xs font-medium">Upload Moments</div>
                  <div className="umo-text-secondary text-xs">Login → My Account → Upload New Moment</div>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 w-5 h-5 bg-green-100 rounded-full flex items-center justify-center text-xs font-bold text-green-600">✓</div>
                <div>
                  <div className="umo-text-primary text-xs font-medium">Approval & Sharing</div>
                  <div className="umo-text-secondary text-xs">Check My Account for status updates</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-50" onClick={closeMobileMenu}>
            <div 
              className="fixed top-0 right-0 h-full w-80 umo-glass shadow-lg transform transition-transform duration-300 ease-in-out"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4">
                {/* Close button */}
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-bold umo-text-primary">Menu</h2>
                  <button
                    onClick={closeMobileMenu}
                    className="umo-btn umo-btn--secondary p-2"
                    style={{ minHeight: '44px', minWidth: '44px' }}
                  >
                    <X size={24} />
                  </button>
                </div>

                {/* Navigation Items */}
                <div className="space-y-4 mb-6">
                  <button
                    onClick={() => { onBrowseModeChange('moments'); closeMobileMenu(); }}
                    className={`umo-btn w-full text-left ${
                      browseMode === 'moments' 
                        ? 'umo-btn--primary' 
                        : 'umo-btn--secondary'
                    }`}
                    style={{ minHeight: '44px' }}
                  >
                    Browse Moments
                  </button>
                  
                  <button
                    onClick={() => { onBrowseModeChange('performances'); closeMobileMenu(); }}
                    className={`umo-btn w-full text-left ${
                      browseMode === 'performances' 
                        ? 'umo-btn--primary' 
                        : 'umo-btn--secondary'
                    }`}
                    style={{ minHeight: '44px' }}
                  >
                    Browse Shows
                  </button>
                  
                  <button
                    onClick={() => { onBrowseModeChange('songs'); closeMobileMenu(); }}
                    className={`umo-btn w-full text-left ${
                      browseMode === 'songs' 
                        ? 'umo-btn--primary' 
                        : 'umo-btn--secondary'
                    }`}
                    style={{ minHeight: '44px' }}
                  >
                    Browse Songs
                  </button>
                </div>

                {/* Account Actions */}
                <div className="border-t border-gray-600 pt-4 space-y-3">
                  {user ? (
                    <>
                      <div className="text-sm umo-text-secondary mb-3">
                        Logged in as: <span className="font-medium umo-text-primary">{user.displayName}</span>
                      </div>
                      
                      <button
                        onClick={() => { onMyAccountClick(); closeMobileMenu(); }}
                        className="umo-btn umo-btn--secondary w-full text-left relative"
                        style={{ minHeight: '44px' }}
                      >
                        My Account
                        {badgeInfo.show && !badgeInfo.isModOrAdmin && (
                          <div 
                            className={`absolute top-2 right-2 w-3 h-3 ${badgeInfo.color === 'blue' ? 'bg-blue-500' : 'bg-red-500'} rounded-full border border-white`}
                            style={{ 
                              minWidth: '12px', 
                              minHeight: '12px',
                              zIndex: 10
                            }}
                          />
                        )}
                      </button>
                      
{(user.role === 'admin' || user.role === 'mod' || user.email === 'solo@solo.solo' || user.email === 'solo2@solo.solo') && (
                        <button
                          onClick={() => { onAdminPanelClick(); closeMobileMenu(); }}
                          className="umo-btn umo-btn--primary w-full text-left relative"
                          style={{ minHeight: '44px' }}
                        >
                          {(user.role === 'admin' || user.email === 'solo@solo.solo' || user.email === 'solo2@solo.solo') ? 'Admin Panel' : 'Moderation Panel'}
                          {badgeInfo.show && badgeInfo.isModOrAdmin && (
                            <div 
                              className={`absolute top-2 right-2 w-3 h-3 ${badgeInfo.color === 'red' ? 'bg-red-500' : 'bg-red-500'} rounded-full border border-white`}
                              style={{ 
                                minWidth: '12px', 
                                minHeight: '12px',
                                zIndex: 10
                              }}
                            />
                          )}
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => { onLoginClick(); closeMobileMenu(); }}
                      className="umo-btn umo-btn--primary w-full text-left"
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
        <div className="flex items-start justify-between mb-4 p-4 bg-white/90 backdrop-blur-sm" style={{ borderRadius: '4px', marginBottom: '1.5rem' }}>
          {/* Title Section */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <button 
                onClick={() => {
                  onToggleHowToGuide();
                  // Don't navigate home when clicking for info
                }}
                className="flex items-center gap-2"
                title="Click for site info and how to use"
              >
                <h1 className="umo-heading umo-heading--lg text-blue-600 hover:text-blue-800 transition-colors">
                  UMO - the best band in the world
                </h1>
                {showHowToGuide ? <ChevronUp size={16} className="text-blue-600" /> : <ChevronDown size={16} className="text-blue-600" />}
              </button>
            </div>
            
            {showHowToGuide && (
              <div className="mt-3 umo-card p-4">
                <h3 className="umo-heading umo-heading--md mb-3">How to Use UMO Archive</h3>
                <p className="umo-text-secondary text-sm mb-4">
                  Explore UMO's complete performance history and upload your own concert moments.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold text-blue-600">1</div>
                    <div>
                      <div className="umo-text-primary font-medium mb-1 text-sm">Browse & Explore</div>
                      <div className="umo-text-secondary text-xs">
                        Use tabs to browse Moments, Shows, Songs. Search by city, venue, or song name.
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold text-blue-600">2</div>
                    <div>
                      <div className="umo-text-primary font-medium mb-1 text-sm">Upload Your Moments</div>
                      <div className="umo-text-secondary text-xs">
                        Login → My Account → Upload New Moment. Add details like song, venue, and date.
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center text-sm font-bold text-orange-600">⏳</div>
                    <div>
                      <div className="umo-text-primary font-medium mb-1 text-sm">Wait for Approval</div>
                      <div className="umo-text-secondary text-xs">
                        Uploads go through moderation. Check My Account for status updates.
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-sm font-bold text-green-600">✓</div>
                    <div>
                      <div className="umo-text-primary font-medium mb-1 text-sm">Enjoy & Share</div>
                      <div className="umo-text-secondary text-xs">
                        Approved moments appear in the public archive for all fans to discover.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Account Controls - Top Right */}
          <div className="flex-shrink-0 ml-2">
            {user ? (
              <div className="text-right space-y-2">
                <div className="text-xs text-gray-600 truncate max-w-32 mb-1">
                  {user.displayName}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={onMyAccountClick}
                    className="umo-btn umo-btn--secondary text-xs whitespace-nowrap relative"
                    style={{ minHeight: '32px' }}
                  >
                    My Account
                    {badgeInfo.show && !badgeInfo.isModOrAdmin && (
                      <div 
                        className={`absolute -top-1 -right-1 w-3 h-3 ${badgeInfo.color === 'blue' ? 'bg-blue-500' : 'bg-red-500'} rounded-full border border-white`}
                        style={{ 
                          minWidth: '12px', 
                          minHeight: '12px',
                          zIndex: 10
                        }}
                      />
                    )}
                  </button>
{(user.role === 'admin' || user.role === 'mod' || user.email === 'solo@solo.solo' || user.email === 'solo2@solo.solo') && (
                    <button
                      onClick={onAdminPanelClick}
                      className="umo-btn umo-btn--primary text-xs whitespace-nowrap relative"
                      style={{ minHeight: '32px' }}
                    >
                      {(user.role === 'admin' || user.email === 'solo@solo.solo' || user.email === 'solo2@solo.solo') ? 'Admin' : 'Mod'}
                      {badgeInfo.show && badgeInfo.isModOrAdmin && (
                        <div 
                          className={`absolute -top-1 -right-1 w-3 h-3 ${badgeInfo.color === 'red' ? 'bg-red-500' : 'bg-red-500'} rounded-full border border-white`}
                          style={{ 
                            minWidth: '12px', 
                            minHeight: '12px',
                            zIndex: 10
                          }}
                        />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-right">
                <div className="text-xs text-gray-500 mb-1">Browse read-only</div>
                <button
                  onClick={onLoginClick}
                  className="umo-btn umo-btn--primary text-sm whitespace-nowrap"
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
            <div className="umo-glass p-1 inline-flex w-full max-w-lg" style={{ borderRadius: '2px' }}>
              <button
                onClick={() => onBrowseModeChange('moments')}
                className={`umo-btn flex-1 ${
                  browseMode === 'moments' 
                    ? 'umo-btn--primary' 
                    : 'umo-btn--ghost'
                }`}
                style={{ minHeight: '44px' }}
              >
                Moments
              </button>
              <button
                onClick={() => onBrowseModeChange('performances')}
                className={`umo-btn flex-1 ${
                  browseMode === 'performances' 
                    ? 'umo-btn--primary' 
                    : 'umo-btn--ghost'
                }`}
                style={{ minHeight: '44px' }}
              >
                Shows
              </button>
              <button
                onClick={() => onBrowseModeChange('songs')}
                className={`umo-btn flex-1 ${
                  browseMode === 'songs' 
                    ? 'umo-btn--primary' 
                    : 'umo-btn--ghost'
                }`}
                style={{ minHeight: '44px' }}
              >
                Songs
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