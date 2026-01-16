import React, { useState, useEffect, memo } from 'react';
import { AuthProvider, useAuth } from './components/Auth/AuthProvider';
import { PlatformSettingsProvider } from './contexts/PlatformSettingsContext';
import { Menu, X, ChevronDown, ChevronUp, Music, Video, Link2, Upload, Film, Calendar, User, LogIn } from 'lucide-react';
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
import ContactForm from './components/Contact/ContactForm';
import UserProfile from './components/User/UserProfile';
import MyAccount from './components/User/MyAccount';
import AdminPanel from './components/Admin/AdminPanel';
import UMOTube from './components/UMOTube/UMOTube';
import TheaterQueue from './components/UI/TheaterQueue';
import VideoHero from './components/UI/VideoHero';
import PublicCollectionView from './components/Collection/PublicCollectionView';
import DesktopSidebar from './components/UI/DesktopSidebar';
import TopContributors from './components/Community/TopContributors';
import { TheaterQueueProvider } from './contexts/TheaterQueueContext';
import { useNotifications } from './hooks';
import { API_BASE_URL } from './components/Auth/AuthProvider';

import { WagmiProvider, createConfig, http } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { baseSepolia, base } from 'wagmi/chains';
import { metaMask, coinbaseWallet, injected } from 'wagmi/connectors';

// Build connectors safely - Coinbase SDK can throw in some environments
const buildConnectors = () => {
  const connectors = [
    metaMask(),
    injected(), // Fallback for browser wallets
  ];

  try {
    connectors.push(coinbaseWallet({
      appName: 'UMO Repository',
    }));
  } catch (e) {
    console.warn('Coinbase wallet connector failed to initialize:', e);
  }

  return connectors;
};

const wagmiConfig = createConfig({
  chains: [baseSepolia, base],
  connectors: buildConnectors(),
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
  const [showContactForm, setShowContactForm] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Public collection state (for shared collection URLs)
  const [publicCollectionId, setPublicCollectionId] = useState(null);

  // Global media filters (affects hero + moments grid)
  // Two toggle groups: Media Type (audio/video) and Source (linked/uploads)
  const [mediaFilters, setMediaFilters] = useState({
    audio: true,
    video: true,
    linked: true,
    uploads: true
  });

  // Toggle filter with prevent-all-off logic
  const toggleFilter = (group, key) => {
    setMediaFilters(prev => {
      // Define which keys belong to which group
      const groups = {
        type: ['audio', 'video'],
        source: ['linked', 'uploads']
      };

      const groupKeys = groups[group];
      const newValue = !prev[key];

      // Check if turning off would leave group empty
      if (!newValue) {
        const otherActive = groupKeys.filter(k => k !== key && prev[k]);
        if (otherActive.length === 0) {
          // Don't allow - at least one must stay on
          return prev;
        }
      }

      return { ...prev, [key]: newValue };
    });
  };

  const { user, logout, loading } = useAuth();

  // Check URL for collection parameter on mount (supports both /collection/:id and ?collection=id)
  useEffect(() => {
    // Check for /collection/:id path format
    const pathMatch = window.location.pathname.match(/^\/collection\/([a-f0-9]+)$/i);
    if (pathMatch) {
      setPublicCollectionId(pathMatch[1]);
      setCurrentView('collection');
      return;
    }

    // Fallback to query parameter format
    const params = new URLSearchParams(window.location.search);
    const collectionId = params.get('collection');
    if (collectionId) {
      setPublicCollectionId(collectionId);
      setCurrentView('collection');
    }
  }, []);
  
  // Notifications hook
  const { getBadgeInfo, refreshNotifications } = useNotifications(API_BASE_URL);
  


  // Navigation handlers
  const handleSongBrowseSelect = (songData) => {
    setSelectedSong(songData);
    setCurrentView('song');
  };

  const handlePerformanceSelect = (performance) => {
    setSelectedPerformance(performance);
    setCurrentView('performance');
  };

  const handleBackToHome = () => {
    setCurrentView('home');
    setSelectedSong(null);
    setSelectedPerformance(null);
    setPublicCollectionId(null);
    // Clear URL params when going back to home
    window.history.replaceState({}, '', window.location.pathname);
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
      {/* Desktop Sidebar - only visible on lg screens */}
      <DesktopSidebar
        browseMode={browseMode}
        onBrowseModeChange={switchBrowseMode}
        mediaFilters={mediaFilters}
        toggleFilter={toggleFilter}
        user={user}
        onShowAccount={() => {
          setShowMyAccount(true);
          refreshNotifications();
        }}
        onLoginClick={() => setShowLogin(true)}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onViewUserProfile={(userId) => {
          setSelectedUserId(userId);
          setShowUserProfile(true);
        }}
      />

      {/* Main content area - offset for sidebar on desktop, bottom padding for mobile nav */}
      <div className={`umo-container-fluid overflow-x-hidden pb-20 sm:pb-0 transition-[margin] duration-300 ease-in-out ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-56'}`}>
        {/* Header with Navigation */}
        <Header
          user={user}
          onLoginClick={() => setShowLogin(true)}
          onMyAccountClick={() => {
            setShowMyAccount(true);
            refreshNotifications();
          }}
          onAdminPanelClick={() => {
            setShowAdminPanel(true);
            refreshNotifications();
          }}
          browseMode={browseMode}
          onBrowseModeChange={switchBrowseMode}
          badgeInfo={getBadgeInfo()}
          showHowToGuide={showHowToGuide}
          onToggleHowToGuide={() => setShowHowToGuide(!showHowToGuide)}
        />


        {/* Cache Status */}
        <CacheStatusDisplay />

        {/* Public Collection View (for shared collection URLs) */}
        {currentView === 'collection' && publicCollectionId && (
          <PublicCollectionView
            collectionId={publicCollectionId}
            onBack={handleBackToHome}
          />
        )}

        {/* Main Content */}
        {currentView !== 'collection' && (
        <MainContent
          currentView={currentView}
          browseMode={browseMode}
          selectedSong={selectedSong}
          selectedPerformance={selectedPerformance}
          onPerformanceSelect={handlePerformanceSelect}
          onSongSelect={handleSongBrowseSelect}
          onBack={handleBackToHome}
          onBrowseModeChange={switchBrowseMode}
          user={user}
          mediaFilters={mediaFilters}
          toggleFilter={toggleFilter}
          onShowAccount={() => {
            setShowMyAccount(true);
            refreshNotifications();
          }}
          onLoginClick={() => setShowLogin(true)}
          onViewUserProfile={(userId) => {
            setSelectedUserId(userId);
            setShowUserProfile(true);
          }}
        />
        )}

        {/* Credits Footer */}
        <CreditsFooter onContactClick={() => setShowContactForm(true)} />
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

      {/* Contact Form */}
      {showContactForm && (
        <div className="fixed inset-0 z-50 overflow-auto">
          <ContactForm
            onBack={() => setShowContactForm(false)}
            user={user}
          />
        </div>
      )}

      {/* User Profile */}
      {showUserProfile && selectedUserId && (
        <div className="fixed inset-0 z-50 overflow-auto">
          <UserProfile
            userId={selectedUserId}
            onBack={() => {
              setShowUserProfile(false);
              setSelectedUserId(null);
            }}
          />
        </div>
      )}

      {/* Theater Queue (always rendered, shows when items in queue) */}
      <TheaterQueue />
    </div>
  );
});

MainApp.displayName = 'MainApp';

// Header Component - Title, How-To Guide, and Mobile Menu (accounts in sidebar for desktop)
const Header = memo(({
  user,
  onLoginClick,
  onMyAccountClick,
  onAdminPanelClick,
  browseMode,
  onBrowseModeChange,
  badgeInfo,
  showHowToGuide,
  onToggleHowToGuide
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="mb-4">
      {/* Mobile Header */}
      <div className="block sm:hidden">
        <div className="flex items-center justify-between p-3 bg-gray-900/90 backdrop-blur-sm border-b border-gray-800" style={{ borderRadius: '2px' }}>
          {/* Logo/Title */}
          <button
            onClick={() => {
              onToggleHowToGuide();
            }}
            className="flex-1 text-left flex items-center gap-2"
            title="Click for site info and how to use"
          >
            <h1 className="text-sm font-semibold text-blue-400">
              UMO Archive
            </h1>
            {showHowToGuide ? <ChevronUp size={14} className="text-blue-400" /> : <ChevronDown size={14} className="text-blue-400" />}
          </button>

          {/* Hamburger Menu Button */}
          <button
            onClick={toggleMobileMenu}
            className="p-2 text-gray-400 hover:text-gray-200 focus:outline-none"
            style={{ minHeight: '44px', minWidth: '44px' }}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* How to Guide - Mobile - Simplified */}
        {showHowToGuide && (
          <div className="mt-2 mb-4 p-3 bg-gray-800/90 border border-gray-700 rounded-sm">
            <h3 className="text-sm font-semibold text-gray-100 mb-2">UMO Archive</h3>
            <p className="text-gray-400 text-xs mb-3">
              Fan-curated concert moments from Unknown Mortal Orchestra.
            </p>

            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 w-5 h-5 bg-blue-900 rounded-full flex items-center justify-center text-xs font-bold text-blue-400">1</div>
                <div>
                  <div className="text-gray-200 text-xs font-medium">Watch & Explore</div>
                  <div className="text-gray-500 text-xs">Filter by Clips, Audio, or Linked. Browse Shows & Songs.</div>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 w-5 h-5 bg-yellow-900 rounded-full flex items-center justify-center text-xs font-bold text-yellow-400">2</div>
                <div>
                  <div className="text-gray-200 text-xs font-medium">Build Playlists</div>
                  <div className="text-gray-500 text-xs">Tap + to queue moments. Keep browsing while music plays.</div>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 w-5 h-5 bg-green-900 rounded-full flex items-center justify-center text-xs font-bold text-green-400">3</div>
                <div>
                  <div className="text-gray-200 text-xs font-medium">Upload & Share</div>
                  <div className="text-gray-500 text-xs">Login → My Account → Upload your concert clips.</div>
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

                  {user && (user.role === 'admin' || user.role === 'mod') && (
                    <button
                      onClick={() => { onBrowseModeChange('umotube'); closeMobileMenu(); }}
                      className={`umo-btn w-full text-left ${
                        browseMode === 'umotube'
                          ? 'umo-btn--primary'
                          : 'umo-btn--secondary'
                      }`}
                      style={{ minHeight: '44px' }}
                    >
                      Linked Media
                    </button>
                  )}
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
                      
{(user.role === 'admin' || user.role === 'mod') && (
                        <button
                          onClick={() => { onAdminPanelClick(); closeMobileMenu(); }}
                          className="umo-btn umo-btn--primary w-full text-left relative"
                          style={{ minHeight: '44px' }}
                        >
                          {user.role === 'admin' ? 'Admin Panel' : 'Moderation Panel'}
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

      {/* Desktop Header - Hidden on lg+ where sidebar handles everything */}
      <div className="hidden sm:block lg:hidden">
        <div className="flex items-center justify-center mb-4 p-3 bg-gray-900/80 backdrop-blur-sm border-b border-gray-800" style={{ borderRadius: '2px' }}>
          <button
            onClick={() => {
              onToggleHowToGuide();
            }}
            className="flex items-center gap-2"
            title="Click for site info and how to use"
          >
            <h1 className="umo-heading umo-heading--lg text-blue-400 hover:text-blue-300 transition-colors">
              UMO - the best band in the world
            </h1>
            {showHowToGuide ? <ChevronUp size={16} className="text-blue-400" /> : <ChevronDown size={16} className="text-blue-400" />}
          </button>
        </div>

        {showHowToGuide && (
          <div className="mb-4 p-4 bg-gray-800/90 border border-gray-700 rounded-sm">
            <h3 className="text-lg font-semibold text-gray-100 mb-3">UMO Archive</h3>
            <p className="text-gray-400 text-sm mb-4">
              Fan-curated archive of Unknown Mortal Orchestra concert moments.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-900 rounded-full flex items-center justify-center text-sm font-bold text-blue-400">1</div>
                <div>
                  <div className="text-gray-200 font-medium mb-1 text-sm">Watch & Explore</div>
                  <div className="text-gray-500 text-xs">
                    Filter by Clips, Audio, or Linked content. Browse Shows, Songs, and fan uploads.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-yellow-900 rounded-full flex items-center justify-center text-sm font-bold text-yellow-400">2</div>
                <div>
                  <div className="text-gray-200 font-medium mb-1 text-sm">Build Playlists</div>
                  <div className="text-gray-500 text-xs">
                    Click + on any moment to add to your queue. Keep browsing while music plays.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-green-900 rounded-full flex items-center justify-center text-sm font-bold text-green-400">3</div>
                <div>
                  <div className="text-gray-200 font-medium mb-1 text-sm">Upload & Share</div>
                  <div className="text-gray-500 text-xs">
                    Login → My Account → Upload. Your moments join the archive after approval.
                  </div>
                </div>
              </div>
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
  onBack,
  onBrowseModeChange,
  user,
  mediaFilters,
  toggleFilter,
  onShowAccount,
  onLoginClick,
  onViewUserProfile
}) => {
  const [heroSelectedMoment, setHeroSelectedMoment] = useState(null);

  // Import MomentDetailModal for hero clicks
  const MomentDetailModal = React.lazy(() => import('./components/Moment/MomentDetailModal'));

  // Non-home views (song detail, performance detail)
  if (currentView === 'song' && selectedSong) {
    return (
      <SongDetail
        songData={selectedSong}
        onBack={onBack}
        onPerformanceSelect={onPerformanceSelect}
      />
    );
  }

  if (currentView === 'performance' && selectedPerformance) {
    return <PerformanceDetail performance={selectedPerformance} onBack={onBack} onViewUserProfile={onViewUserProfile} onNavigateToSong={onSongSelect} />;
  }

  // Home view - Hero persists above navigation tabs
  return (
    <>
      {/* Media Filter Pills - Above Hero (hidden on lg where sidebar has them) */}
      <div className="flex justify-center mb-4 lg:hidden">
        <div className="flex gap-3 items-center bg-gray-900/80 backdrop-blur-sm p-2 rounded-sm border border-gray-800">
          {/* Media Type Group */}
          <div className="flex gap-1 bg-gray-800 p-0.5 rounded-sm">
            <button
              onClick={() => toggleFilter('type', 'audio')}
              title="Audio"
              className={`p-1.5 rounded-sm transition-all ${
                mediaFilters.audio
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-400 hover:bg-gray-700'
              }`}
            >
              <Music size={16} />
            </button>
            <button
              onClick={() => toggleFilter('type', 'video')}
              title="Video"
              className={`p-1.5 rounded-sm transition-all ${
                mediaFilters.video
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-400 hover:bg-gray-700'
              }`}
            >
              <Video size={16} />
            </button>
          </div>
          {/* Source Group */}
          <div className="flex gap-1 bg-gray-800 p-0.5 rounded-sm">
            <button
              onClick={() => toggleFilter('source', 'linked')}
              title="Linked"
              className={`p-1.5 rounded-sm transition-all ${
                mediaFilters.linked
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-400 hover:bg-gray-700'
              }`}
            >
              <Link2 size={16} />
            </button>
            <button
              onClick={() => toggleFilter('source', 'uploads')}
              title="Uploads"
              className={`p-1.5 rounded-sm transition-all ${
                mediaFilters.uploads
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-400 hover:bg-gray-700'
              }`}
            >
              <Upload size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* VideoHero - Big random clip player, persists across all home tabs */}
      <VideoHero
        onMomentClick={(moment) => setHeroSelectedMoment(moment)}
        mediaFilters={mediaFilters}
      />

      {/* Navigation Tabs - Below Hero (Desktop - hidden on lg where sidebar shows) */}
      <div className="hidden sm:flex lg:hidden justify-center mb-6">
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
          {user && (user.role === 'admin' || user.role === 'mod') && (
            <button
              onClick={() => onBrowseModeChange('umotube')}
              className={`umo-btn flex-1 ${
                browseMode === 'umotube'
                  ? 'umo-btn--primary'
                  : 'umo-btn--ghost'
              }`}
              style={{ minHeight: '44px' }}
            >
              Linked Media
            </button>
          )}
        </div>
      </div>

      {/* Tab Content */}
      {browseMode === 'moments' && (
        <MomentBrowser
          onSongSelect={onSongSelect}
          onPerformanceSelect={onPerformanceSelect}
          mediaFilters={mediaFilters}
        />
      )}
      {browseMode === 'performances' && (
        <PerformanceList onPerformanceSelect={onPerformanceSelect} />
      )}
      {browseMode === 'songs' && (
        <SongBrowser onSongSelect={onSongSelect} />
      )}
      {browseMode === 'umotube' && (
        <UMOTube user={user} />
      )}

      {/* Modal for hero click */}
      {heroSelectedMoment && (
        <React.Suspense fallback={<div>Loading...</div>}>
          <MomentDetailModal
            moment={heroSelectedMoment}
            onClose={() => setHeroSelectedMoment(null)}
          />
        </React.Suspense>
      )}

      {/* Mobile Bottom Navigation */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-gray-900/95 backdrop-blur-sm border-t border-gray-700" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex justify-around items-center py-1">
          <button
            onClick={() => onBrowseModeChange('moments')}
            style={{ minHeight: '56px', minWidth: '60px' }}
            className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
              browseMode === 'moments' ? 'text-yellow-400' : 'text-gray-400'
            }`}
          >
            <Film size={20} />
            <span className="text-[10px] font-medium">Moments</span>
          </button>
          <button
            onClick={() => onBrowseModeChange('performances')}
            style={{ minHeight: '56px', minWidth: '60px' }}
            className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
              browseMode === 'performances' ? 'text-yellow-400' : 'text-gray-400'
            }`}
          >
            <Calendar size={20} />
            <span className="text-[10px] font-medium">Shows</span>
          </button>
          <button
            onClick={() => onBrowseModeChange('songs')}
            style={{ minHeight: '56px', minWidth: '60px' }}
            className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
              browseMode === 'songs' ? 'text-yellow-400' : 'text-gray-400'
            }`}
          >
            <Music size={20} />
            <span className="text-[10px] font-medium">Songs</span>
          </button>
          {user ? (
            <button
              onClick={onShowAccount}
              style={{ minHeight: '56px', minWidth: '60px' }}
              className="flex flex-col items-center justify-center gap-0.5 text-gray-400 transition-colors"
            >
              <User size={20} />
              <span className="text-[10px] font-medium">Account</span>
            </button>
          ) : (
            <button
              onClick={onLoginClick}
              style={{ minHeight: '56px', minWidth: '60px' }}
              className="flex flex-col items-center justify-center gap-0.5 text-gray-400 transition-colors"
            >
              <LogIn size={20} />
              <span className="text-[10px] font-medium">Login</span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom padding spacer for mobile nav */}
      <div className="sm:hidden h-20" />
    </>
  );
});

MainContent.displayName = 'MainContent';

// ✅ UPDATED: Main App Export with Web3 providers
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <PlatformSettingsProvider>
          <AuthProvider>
            <TheaterQueueProvider>
              <MainApp />
            </TheaterQueueProvider>
          </AuthProvider>
        </PlatformSettingsProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}