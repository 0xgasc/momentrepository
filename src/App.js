import React, { useState, useEffect, memo, useMemo } from 'react';
import { Routes, Route, useNavigate, useLocation, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/Auth/AuthProvider';
import { slugify } from './utils/slugify';
import { PlatformSettingsProvider } from './contexts/PlatformSettingsContext';
import { Menu, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Music, Video, Link2, Upload, Film, Calendar, User, LogIn, Play, Pause, SkipForward, SkipBack, Shuffle, Volume2, VolumeX, Settings, ListMusic } from 'lucide-react';
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
import { TheaterQueueProvider, useTheaterQueue } from './contexts/TheaterQueueContext';
import { ThemeProvider } from './contexts/ThemeContext';
import SettingsPanel from './components/UI/SettingsPanel';
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
  // Router hooks
  const navigate = useNavigate();
  const location = useLocation();

  // Detect if running in iframe or forceDesktop URL param
  const isEmbedded = useMemo(() => {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true; // Cross-origin iframe
    }
  }, []);

  const forceDesktop = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('forceDesktop') === 'true' || params.get('embed') === 'true' || isEmbedded;
  }, [isEmbedded]);

  // Add force-desktop class to body when embedded
  useEffect(() => {
    if (forceDesktop) {
      document.body.classList.add('force-desktop');
    } else {
      document.body.classList.remove('force-desktop');
    }
    return () => document.body.classList.remove('force-desktop');
  }, [forceDesktop]);

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
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarPosition, setSidebarPosition] = useState(() => {
    // Load from localStorage or default to 'right'
    return localStorage.getItem('umo-sidebar-position') || 'right';
  });

  // Save sidebar position to localStorage when changed
  const changeSidebarPosition = (newPosition) => {
    setSidebarPosition(newPosition);
    localStorage.setItem('umo-sidebar-position', newPosition);
  };

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

  // Handle URL-based navigation on mount and location changes
  useEffect(() => {
    const pathname = location.pathname;

    // Check for /collection/:id path format
    const collectionMatch = pathname.match(/^\/collection\/([a-f0-9]+)$/i);
    if (collectionMatch) {
      setPublicCollectionId(collectionMatch[1]);
      setCurrentView('collection');
      return;
    }

    // Check for /song/:slug path format
    const songMatch = pathname.match(/^\/song\/(.+)$/);
    if (songMatch) {
      const songSlug = decodeURIComponent(songMatch[1]);
      // Store the slug - SongDetail will fetch data based on it
      setSelectedSong({ songSlug, songName: null });
      setCurrentView('song');
      setBrowseMode('songs');
      return;
    }

    // Check for /show/:id path format
    const showMatch = pathname.match(/^\/show\/(.+)$/);
    if (showMatch) {
      const performanceId = decodeURIComponent(showMatch[1]);
      // Store the ID - PerformanceDetail will fetch data based on it
      setSelectedPerformance({ id: performanceId });
      setCurrentView('performance');
      setBrowseMode('performances');
      return;
    }

    // Check for /songs path
    if (pathname === '/songs') {
      setBrowseMode('songs');
      setCurrentView('home');
      return;
    }

    // Check for /shows path
    if (pathname === '/shows') {
      setBrowseMode('performances');
      setCurrentView('home');
      return;
    }

    // Fallback to query parameter format for collections
    const params = new URLSearchParams(location.search);
    const collectionId = params.get('collection');
    if (collectionId) {
      setPublicCollectionId(collectionId);
      setCurrentView('collection');
      return;
    }

    // Check for shared playlist link (encoded playlist data)
    const playlistData = params.get('playlist');
    if (playlistData) {
      // Import will be handled by HomeContent component - ensure we're on home view
      setCurrentView('home');
      setSelectedSong(null);
      setSelectedPerformance(null);
      setPublicCollectionId(null);
      return;
    }

    // Default: home view
    if (pathname === '/' || pathname === '') {
      if (currentView !== 'home') {
        setCurrentView('home');
        setSelectedSong(null);
        setSelectedPerformance(null);
        setPublicCollectionId(null);
      }
    }
  }, [location.pathname, location.search]);
  
  // Notifications hook
  const { getBadgeInfo, refreshNotifications } = useNotifications(API_BASE_URL);
  


  // Navigation handlers with URL routing
  const handleSongBrowseSelect = (songData) => {
    const songName = songData.songName || songData.name;
    if (songName) {
      const slug = slugify(songName);
      setSelectedSong({ ...songData, songSlug: slug });
      setCurrentView('song');
      navigate(`/song/${slug}`);
    } else if (songData.songSlug) {
      // Already have a slug (from URL navigation)
      setSelectedSong(songData);
      setCurrentView('song');
    }
  };

  const handlePerformanceSelect = (performance) => {
    setSelectedPerformance(performance);
    setCurrentView('performance');
    // Use performance ID for URL
    const perfId = performance.id || performance._id;
    if (perfId) {
      navigate(`/show/${perfId}`);
    }
  };

  const handleBackToHome = () => {
    setCurrentView('home');
    setSelectedSong(null);
    setSelectedPerformance(null);
    setPublicCollectionId(null);
    navigate('/');
  };

  const switchBrowseMode = (mode) => {
    setBrowseMode(mode);
    setSelectedSong(null);
    setSelectedPerformance(null);
    setCurrentView('home');
    // Update URL based on browse mode
    if (mode === 'songs') {
      navigate('/songs');
    } else if (mode === 'performances') {
      navigate('/shows');
    } else {
      navigate('/');
    }
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
        onAdminPanelClick={() => setShowAdminPanel(true)}
        onLoginClick={() => setShowLogin(true)}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onViewUserProfile={(userId) => {
          setSelectedUserId(userId);
          setShowUserProfile(true);
        }}
        position={sidebarPosition}
        onShowSettings={() => setShowSettings(true)}
      />

      {/* Main content area - offset for sidebar on desktop, bottom padding for mobile nav */}
      <div className={`umo-container-fluid overflow-x-hidden pb-20 sm:pb-0 bg-gray-950 transition-[margin] duration-300 ease-in-out ${
        sidebarPosition === 'left'
          ? (sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-56')
          : sidebarPosition === 'right'
            ? (sidebarCollapsed ? 'lg:mr-16' : 'lg:mr-56')
            : sidebarPosition === 'top'
              ? 'lg:mt-16'
              : 'lg:mb-16'
      }`}>
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

      {/* User Profile Modal */}
      {showUserProfile && selectedUserId && (
        <UserProfile
          userId={selectedUserId}
          onClose={() => {
            setShowUserProfile(false);
            setSelectedUserId(null);
          }}
        />
      )}

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        position={sidebarPosition}
        onPositionChange={changeSidebarPosition}
        user={user}
        onLoginClick={() => {
          setShowSettings(false);
          setShowLogin(true);
        }}
      />

      {/* Theater Queue (always rendered, shows when items in queue) */}
      <TheaterQueue sidebarPosition={sidebarPosition} sidebarCollapsed={sidebarCollapsed} />

      {/* Mobile Bottom Navigation - Always visible on mobile */}
      <MobileBottomNav
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
      />

      {/* Bottom padding spacer for mobile nav */}
      <div className="sm:hidden h-20" />
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

  // Theater queue for playlist import
  const { importPlaylistFromLink, playQueue } = useTheaterQueue();

  // Playlist import status
  const [playlistImportStatus, setPlaylistImportStatus] = useState(null); // { loading, success, error, name, count }

  // Handle shared playlist import from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const playlistData = params.get('playlist');

    if (playlistData && !playlistImportStatus) {
      setPlaylistImportStatus({ loading: true });

      importPlaylistFromLink(playlistData, API_BASE_URL)
        .then(result => {
          if (result.success) {
            setPlaylistImportStatus({
              loading: false,
              success: true,
              name: result.name,
              count: result.count
            });
            // Auto-start playback
            setTimeout(() => playQueue(0), 500);
            // Clear URL param
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
            // Auto-dismiss after 5 seconds
            setTimeout(() => setPlaylistImportStatus(null), 5000);
          } else {
            setPlaylistImportStatus({
              loading: false,
              success: false,
              error: result.error
            });
            setTimeout(() => setPlaylistImportStatus(null), 5000);
          }
        });
    }
  }, []); // Only on mount

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
      {/* Playlist Import Toast */}
      {playlistImportStatus && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className={`px-4 py-3 rounded-lg shadow-xl backdrop-blur-sm border ${
            playlistImportStatus.loading
              ? 'bg-gray-900/90 border-gray-700 text-white'
              : playlistImportStatus.success
                ? 'bg-green-900/90 border-green-700 text-green-200'
                : 'bg-red-900/90 border-red-700 text-red-200'
          }`}>
            {playlistImportStatus.loading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                <span>Loading shared playlist...</span>
              </div>
            ) : playlistImportStatus.success ? (
              <div className="flex items-center gap-2">
                <ListMusic size={18} className="text-green-400" />
                <span>Loaded "{playlistImportStatus.name}" ({playlistImportStatus.count} tracks)</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <X size={18} className="text-red-400" />
                <span>Failed to load playlist: {playlistImportStatus.error}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Media Filter Pills - Tablet only (mobile uses bottom ribbon, desktop uses sidebar) */}
      <div className="hidden sm:flex lg:hidden justify-center mb-4">
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
    </>
  );
});

MainContent.displayName = 'MainContent';

// Mobile Bottom Navigation - Always visible on mobile, regardless of view
const MobileBottomNav = memo(({
  browseMode,
  onBrowseModeChange,
  mediaFilters,
  toggleFilter,
  user,
  onShowAccount,
  onLoginClick
}) => {
  const [mobileNavPage, setMobileNavPage] = useState(0);
  const [mobilePlayerExpanded, setMobilePlayerExpanded] = useState(false);

  const {
    currentMoment,
    isPlayingFromQueue,
    playerState,
    togglePlayPause,
    toggleMute,
    setVolume,
    playNextInQueue,
    playPrevInQueue,
    playRandom,
    theaterQueue,
    currentQueueIndex
  } = useTheaterQueue();

  return (
    <>
      {/* Mobile Mini Player - Above Bottom Nav */}
      {(isPlayingFromQueue || currentMoment) && currentMoment && (
        <div className="sm:hidden fixed left-0 right-0 z-40" style={{ bottom: 'calc(52px + env(safe-area-inset-bottom, 0px))' }}>
          <div className="mx-2 mb-1 bg-black/60 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl overflow-hidden">
            {/* Progress bar at top */}
            <div className="h-1 bg-white/20 cursor-pointer">
              <div
                className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all duration-300"
                style={{ width: `${(playerState.currentTime / playerState.duration) * 100 || 0}%` }}
              />
            </div>

            {/* Main row - always visible */}
            <div className="flex items-center gap-2 px-3 py-2">
              {/* Expand/collapse toggle */}
              <button
                onClick={() => setMobilePlayerExpanded(!mobilePlayerExpanded)}
                className="p-1 text-gray-400 hover:text-white transition-colors"
              >
                {mobilePlayerExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </button>

              {/* Song info */}
              <div className="flex-1 min-w-0" onClick={() => setMobilePlayerExpanded(!mobilePlayerExpanded)}>
                <div className="text-sm font-medium text-white truncate">
                  {currentMoment.songName || 'Unknown'}
                </div>
                <div className="text-[10px] text-gray-400 truncate">
                  {currentMoment.venueName || currentMoment.venueCity || currentMoment.performanceDate || 'Live'}
                </div>
              </div>

              {/* Controls - compact */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {/* Mute toggle */}
                <button
                  onClick={() => toggleMute()}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  {playerState.isMuted
                    ? <VolumeX size={16} className="text-orange-400" />
                    : <Volume2 size={16} className="text-gray-400" />
                  }
                </button>
                {/* Play/Pause */}
                <button
                  onClick={togglePlayPause}
                  className="p-2 rounded-full bg-yellow-500/20 hover:bg-yellow-500/40 transition-colors"
                >
                  {playerState.isPlaying
                    ? <Pause size={18} className="text-yellow-400" />
                    : <Play size={18} className="text-yellow-400 ml-0.5" />
                  }
                </button>
                {/* Next/Random */}
                <button
                  onClick={() => theaterQueue.length > 0 && currentQueueIndex < theaterQueue.length - 1 ? playNextInQueue() : playRandom()}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  {theaterQueue.length > 0 && currentQueueIndex < theaterQueue.length - 1
                    ? <SkipForward size={16} className="text-gray-400" />
                    : <Shuffle size={16} className="text-gray-400" />
                  }
                </button>
              </div>
            </div>

            {/* Expanded controls */}
            {mobilePlayerExpanded && (
              <div className="px-3 pb-3 pt-1 border-t border-white/5 bg-white/5">
                {/* Full transport controls */}
                <div className="flex items-center justify-center gap-4 mb-3">
                  <button
                    onClick={() => playPrevInQueue()}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <SkipBack size={20} className="text-gray-300" />
                  </button>
                  <button
                    onClick={togglePlayPause}
                    className="p-3 rounded-full bg-yellow-500/30 hover:bg-yellow-500/50 transition-colors"
                  >
                    {playerState.isPlaying
                      ? <Pause size={24} className="text-yellow-400" />
                      : <Play size={24} className="text-yellow-400 ml-0.5" />
                    }
                  </button>
                  <button
                    onClick={() => theaterQueue.length > 0 && currentQueueIndex < theaterQueue.length - 1 ? playNextInQueue() : playRandom()}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  >
                    {theaterQueue.length > 0 && currentQueueIndex < theaterQueue.length - 1
                      ? <SkipForward size={20} className="text-gray-300" />
                      : <Shuffle size={20} className="text-gray-300" />
                    }
                  </button>
                </div>

                {/* Volume control */}
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => toggleMute()}
                    className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                  >
                    {playerState.isMuted
                      ? <VolumeX size={18} className="text-orange-400" />
                      : <Volume2 size={18} className="text-gray-400" />
                    }
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={playerState.isMuted ? 0 : playerState.volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="flex-1 h-1 bg-gray-700 rounded-full appearance-none cursor-pointer
                             [&::-webkit-slider-thumb]:appearance-none
                             [&::-webkit-slider-thumb]:w-3
                             [&::-webkit-slider-thumb]:h-3
                             [&::-webkit-slider-thumb]:rounded-full
                             [&::-webkit-slider-thumb]:bg-yellow-400
                             [&::-webkit-slider-thumb]:cursor-pointer"
                  />
                </div>

                {/* Time display */}
                <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                  <span>{Math.floor(playerState.currentTime / 60)}:{String(Math.floor(playerState.currentTime % 60)).padStart(2, '0')}</span>
                  <span>{Math.floor(playerState.duration / 60)}:{String(Math.floor(playerState.duration % 60)).padStart(2, '0')}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation - Rotating Ribbon */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-black/60 backdrop-blur-xl border-t border-white/10" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-center">
          {/* Left arrow */}
          <button
            onClick={() => setMobileNavPage(p => p === 0 ? 1 : 0)}
            className="p-2 text-gray-500 hover:text-white transition-colors"
          >
            <ChevronLeft size={16} />
          </button>

          {/* Content area - swappable pages */}
          <div className="flex-1 overflow-hidden">
            {/* Page 0: Main Navigation */}
            {mobileNavPage === 0 && (
              <div className="flex justify-around items-center py-1.5">
                <button
                  onClick={() => onBrowseModeChange('moments')}
                  className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 transition-colors ${
                    browseMode === 'moments' ? 'text-yellow-400' : 'text-gray-400'
                  }`}
                >
                  <Film size={18} />
                  <span className="text-[9px] font-medium">Moments</span>
                </button>
                <button
                  onClick={() => onBrowseModeChange('performances')}
                  className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 transition-colors ${
                    browseMode === 'performances' ? 'text-yellow-400' : 'text-gray-400'
                  }`}
                >
                  <Calendar size={18} />
                  <span className="text-[9px] font-medium">Shows</span>
                </button>
                <button
                  onClick={() => onBrowseModeChange('songs')}
                  className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 transition-colors ${
                    browseMode === 'songs' ? 'text-yellow-400' : 'text-gray-400'
                  }`}
                >
                  <Music size={18} />
                  <span className="text-[9px] font-medium">Songs</span>
                </button>
                {user ? (
                  <button
                    onClick={onShowAccount}
                    className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 text-gray-400 transition-colors"
                  >
                    <User size={18} />
                    <span className="text-[9px] font-medium">Account</span>
                  </button>
                ) : (
                  <button
                    onClick={onLoginClick}
                    className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 text-gray-400 transition-colors"
                  >
                    <LogIn size={18} />
                    <span className="text-[9px] font-medium">Login</span>
                  </button>
                )}
              </div>
            )}

            {/* Page 1: Source & Media Filters */}
            {mobileNavPage === 1 && (
              <div className="flex justify-around items-center py-1.5">
                <button
                  onClick={() => toggleFilter('source', 'linked')}
                  className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 transition-colors ${
                    mediaFilters.linked ? 'text-blue-400' : 'text-gray-500'
                  }`}
                >
                  <Link2 size={18} />
                  <span className="text-[9px] font-medium">Linked</span>
                </button>
                <button
                  onClick={() => toggleFilter('source', 'uploads')}
                  className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 transition-colors ${
                    mediaFilters.uploads ? 'text-blue-400' : 'text-gray-500'
                  }`}
                >
                  <Upload size={18} />
                  <span className="text-[9px] font-medium">Uploads</span>
                </button>
                <button
                  onClick={() => toggleFilter('type', 'audio')}
                  className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 transition-colors ${
                    mediaFilters.audio ? 'text-blue-400' : 'text-gray-500'
                  }`}
                >
                  <Music size={18} />
                  <span className="text-[9px] font-medium">Audio</span>
                </button>
                <button
                  onClick={() => toggleFilter('type', 'video')}
                  className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 transition-colors ${
                    mediaFilters.video ? 'text-blue-400' : 'text-gray-500'
                  }`}
                >
                  <Video size={18} />
                  <span className="text-[9px] font-medium">Video</span>
                </button>
              </div>
            )}
          </div>

          {/* Right arrow */}
          <button
            onClick={() => setMobileNavPage(p => p === 0 ? 1 : 0)}
            className="p-2 text-gray-500 hover:text-white transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </>
  );
});

MobileBottomNav.displayName = 'MobileBottomNav';

// ✅ UPDATED: Main App Export with Web3 providers
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <PlatformSettingsProvider>
          <AuthProvider>
            <ThemeProvider>
              <TheaterQueueProvider>
                <MainApp />
              </TheaterQueueProvider>
            </ThemeProvider>
          </AuthProvider>
        </PlatformSettingsProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}