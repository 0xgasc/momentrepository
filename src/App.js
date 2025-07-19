import React, { useState, memo } from 'react';
import { AuthProvider, useAuth } from './components/Auth/AuthProvider';
import { PlatformSettingsProvider } from './contexts/PlatformSettingsContext';
import { Menu, X, Info, ChevronDown, ChevronUp } from 'lucide-react';

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
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 max-w-7xl mx-auto">
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
                        className="w-full text-left p-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors relative"
                        style={{ minHeight: '44px' }}
                      >
                        👤 My Account
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
                          className="w-full text-left p-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors relative"
                          style={{ minHeight: '44px' }}
                        >
                          {(user.role === 'admin' || user.email === 'solo@solo.solo' || user.email === 'solo2@solo.solo') ? 'Admin Panel' : '🛡️ Moderation Panel'}
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
            <div className="flex items-center gap-2 mb-2">
              <button onClick={onHomeClick}>
                <h1 className="text-lg sm:text-xl font-bold text-blue-600 hover:text-blue-800 transition-colors leading-tight">
                  UMO - the best band in the world
                </h1>
              </button>
              <button
                onClick={onToggleHowToGuide}
                className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm transition-colors"
                title="How to use this site"
              >
                <Info size={16} />
                {showHowToGuide ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
            
            {showHowToGuide && (
              <div className="mt-3 p-4 bg-blue-50 rounded-lg border border-blue-200 text-sm text-gray-700">
                <div className="mb-4 p-3 bg-blue-100 rounded-lg border-l-4 border-blue-500">
                  <p className="text-blue-800 font-medium">
                    Explore UMO's entire performance history, search by city or venue, and upload your own moments from concerts.
                  </p>
                </div>
                
                <h4 className="font-semibold text-blue-900 mb-3">📱 How to Use UMO Archive</h4>
                
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-medium">1</span>
                    <div>
                      <strong>Browse & Explore</strong>
                      <p className="text-gray-600 mt-1">Use the tabs above to browse <strong>Moments</strong> (fan uploads), <strong>Shows</strong> (complete setlists), and <strong>Songs</strong> (performance history). Search by city, venue, or song name.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-medium">2</span>
                    <div>
                      <strong>Upload Your Moments</strong>
                      <p className="text-gray-600 mt-1">Logged-in users can upload videos, photos, or audio from UMO concerts. Click "Login to Upload" → "My Account" → "Upload New Moment". Add details like song name, venue, and date.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-medium">3</span>
                    <div>
                      <strong>Wait for Approval</strong>
                      <p className="text-gray-600 mt-1">Uploaded moments go through moderation to ensure quality and accuracy. You'll see status updates in "My Account" - blue dot means pending approval, red means needs revision.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full text-xs flex items-center justify-center font-medium">✓</span>
                    <div>
                      <strong>Enjoy & Share</strong>
                      <p className="text-gray-600 mt-1">Once approved, your moment appears in the public archive! Other fans can discover, download, and enjoy your contribution to UMO history.</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 pt-3 border-t border-blue-200">
                  <p className="text-xs text-gray-500">
                    💡 <strong>Pro tip:</strong> Higher quality files (larger sizes) and complete metadata (description, mood, etc.) help create a richer archive for all fans!
                  </p>
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
                    className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 transition-colors whitespace-nowrap relative"
                    style={{ minHeight: '32px' }}
                  >
                    👤 My Account
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
                      className="px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 transition-colors whitespace-nowrap relative"
                      style={{ minHeight: '32px' }}
                    >
                      {(user.role === 'admin' || user.email === 'solo@solo.solo' || user.email === 'solo2@solo.solo') ? 'Admin' : '🛡️ Mod'}
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