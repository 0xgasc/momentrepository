import React, { useState, useEffect, memo, useMemo, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/Auth/AuthProvider';
import { slugify } from './utils/slugify';
import { PlatformSettingsProvider } from './contexts/PlatformSettingsContext';
import { Menu, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Music, Video, Link2, Upload, Film, Calendar, User, LogIn, Play, Pause, SkipForward, SkipBack, Shuffle, Volume2, VolumeX, Settings, ListMusic, Trophy, Trash2, Eye, EyeOff } from 'lucide-react';
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
import NotificationBell from './components/UI/NotificationBell';
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
  const [initialMomentId, setInitialMomentId] = useState(null);
  const [showLanding, setShowLanding] = useState(location.pathname === '/');
  const [showLandingOverlay, setShowLandingOverlay] = useState(true); // Toggle for landing page overlay
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarPosition, setSidebarPosition] = useState(() => {
    // Load from localStorage or default to 'top'
    return localStorage.getItem('umo-sidebar-position') || 'top';
  });

  // Save sidebar position to localStorage when changed
  const changeSidebarPosition = (newPosition) => {
    setSidebarPosition(newPosition);
    localStorage.setItem('umo-sidebar-position', newPosition);
  };

  // Public collection state (for shared collection URLs)
  const [publicCollectionId, setPublicCollectionId] = useState(null);

  const [autoplayPreviews, setAutoplayPreviews] = useState(true);

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

    // Check for /user/:id path format
    const userMatch = pathname.match(/^\/user\/([a-f0-9]+)$/i);
    if (userMatch) {
      setSelectedUserId(userMatch[1]);
      setShowUserProfile(true);
      return;
    }

    // Check for /moment/:id path format
    const momentMatch = pathname.match(/^\/moment\/([a-f0-9]+)$/i);
    if (momentMatch) {
      setInitialMomentId(momentMatch[1]);
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
  // Scroll position ref for restoration when navigating back to home
  const savedScrollY = useRef(0);

  const handleSongBrowseSelect = (songData) => {
    savedScrollY.current = window.scrollY;
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
    savedScrollY.current = window.scrollY;
    setSelectedPerformance(performance);
    setCurrentView('performance');
    // Use performance ID for URL
    const perfId = performance.id || performance._id;
    if (perfId) {
      navigate(`/show/${perfId}`);
    }
  };

  const handleBackToHome = () => {
    setShowLanding(false); // going back from song/show → stay in browse, not landing
    setCurrentView('home');
    setSelectedSong(null);
    setSelectedPerformance(null);
    setPublicCollectionId(null);
    navigate('/');
    // Restore scroll position after React re-renders
    const y = savedScrollY.current;
    if (y > 0) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => window.scrollTo(0, y));
      });
    }
  };

  const switchBrowseMode = (mode) => {
    setBrowseMode(mode);
    setSelectedSong(null);
    setSelectedPerformance(null);
    setCurrentView('home');
    setShowLanding(false);
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
      <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
        <div className="w-full max-w-md">
          <LoginModal onClose={() => setShowLogin(false)} />
          <div className="p-4 border-t border-gray-200">
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
        onViewUserProfile={(userId) => {
          setSelectedUserId(userId);
          setShowUserProfile(true);
          navigate(`/user/${userId}`, { replace: true });
        }}
        position={sidebarPosition}
        onShowSettings={() => setShowSettings(true)}
        onToggleHowToGuide={() => setShowHowToGuide(!showHowToGuide)}
        onShowLanding={() => { setShowLanding(true); navigate('/'); }}
        autoplayPreviews={autoplayPreviews}
        onToggleAutoplay={() => setAutoplayPreviews(prev => !prev)}
      />

      {/* Main content area - offset for sidebar on desktop, bottom padding for mobile nav */}
      <div className={`umo-container-fluid overflow-x-hidden pb-32 sm:pb-0 bg-gray-950 transition-[margin] duration-300 ease-in-out ${
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
          onMomentSelect={null}
          onShowLanding={() => { setShowLanding(true); navigate('/'); }}
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
          autoplayPreviews={autoplayPreviews}
          onShowAccount={() => {
            setShowMyAccount(true);
            refreshNotifications();
          }}
          onLoginClick={() => setShowLogin(true)}
          onViewUserProfile={(userId) => {
            setSelectedUserId(userId);
            setShowUserProfile(true);
            navigate(`/user/${userId}`, { replace: true });
          }}
          initialMomentId={initialMomentId}
          showLanding={showLanding}
          onShowLanding={(mode) => {
            if (mode) {
              setShowLanding(false);
              switchBrowseMode(mode);
            } else {
              setShowLanding(true);
              navigate('/');
            }
          }}
          showLandingOverlay={showLandingOverlay}
          setShowLandingOverlay={setShowLandingOverlay}
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
            navigate('/', { replace: true });
          }}
          currentUserId={user?._id || user?.id}
          onPerformanceSelect={(perf) => {
            setShowUserProfile(false);
            setSelectedUserId(null);
            navigate('/', { replace: true });
            handlePerformanceSelect(perf);
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

      {/* Bottom padding spacer for mobile nav + mini player */}
      <div className="sm:hidden h-32" />
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
  onToggleHowToGuide,
  onMomentSelect,
  onShowLanding
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
            onClick={() => onShowLanding?.()}
            className="flex-1 text-left flex items-center gap-2"
            title="UMO Archive home"
          >
            <h1 className="text-sm font-semibold text-blue-400">
              UMO Archive
            </h1>
          </button>

          {/* Notification Bell (mobile) */}
          {user && (
            <NotificationBell onMomentSelect={onMomentSelect} />
          )}

          {/* Hamburger Menu Button */}
          <button
            onClick={toggleMobileMenu}
            className="p-2 text-gray-400 hover:text-gray-200 focus:outline-none"
            style={{ minHeight: '44px', minWidth: '44px' }}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

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

                {/* Top Contributors / Leaderboard */}
                <div className="border-t border-gray-600 pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy size={14} className="text-yellow-400" />
                    <span className="text-sm font-medium text-gray-300">Top Contributors</span>
                  </div>
                  <TopContributors compact />
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
            onClick={() => onShowLanding?.()}
            className="flex items-center gap-2"
            title="UMO Archive home"
          >
            <h1 className="umo-heading umo-heading--lg text-blue-400 hover:text-blue-300 transition-colors">
              UMO Archive
            </h1>
          </button>
        </div>

      </div>
    </div>
  );
});

Header.displayName = 'Header';

// Simple error boundary for lazy-loaded components
class ModalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-gray-900 border border-gray-700 p-6 rounded-lg text-center">
            <p className="text-white mb-3">Failed to load. Please refresh.</p>
            <button onClick={this.props.onClose} className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600">Close</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Landing Page Content — text, CTA cards, steps. VideoHero is rendered separately below it.
const LandingPageContent = memo(({ user, onNavigate, onLoginClick, onToggleOverlay, overlayVisible }) => {
  const ctaCards = [
    {
      mode: 'moments',
      label: 'Moments',
      desc: 'Fan clips, audio recordings, and live footage from shows around the world.'
    },
    {
      mode: 'songs',
      label: 'Songs',
      desc: 'Every track in the catalog — explore how each song evolved across performances.'
    },
    {
      mode: 'performances',
      label: 'Shows',
      desc: 'Full setlists, community guestbooks, and memories for every concert.'
    }
  ];

  return (
    <div className="text-gray-100 relative">
      {/* Toggle Overlay Button */}
      <button
        onClick={onToggleOverlay}
        className="absolute top-3 right-3 z-50 bg-black/60 hover:bg-black/80 backdrop-blur-sm border border-white/20 rounded-full p-2.5 transition-all group"
        title={overlayVisible ? "Show video" : "Show info"}
      >
        {overlayVisible ? (
          <EyeOff size={18} className="text-white group-hover:text-blue-400 transition-colors" />
        ) : (
          <Eye size={18} className="text-white group-hover:text-blue-400 transition-colors" />
        )}
      </button>

      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Tagline */}
        <div className="mb-10">
          <p className="text-gray-500 text-xs uppercase tracking-widest mb-3">UMO Archive</p>
          <h2 className="text-xl sm:text-2xl font-semibold text-white mb-3 leading-snug">
            The fan-built Unknown Mortal Orchestra concert archive
          </h2>
          <p className="text-gray-400 text-sm max-w-xl">
            Fans capturing, cataloguing, and preserving live moments — from small club shows to festival stages.
          </p>
        </div>

        {/* CTA nav */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-gray-800 border border-gray-800 mb-10">
          {ctaCards.map(({ mode, label, desc }) => (
            <button
              key={mode}
              onClick={() => onNavigate(mode)}
              className="group text-left bg-gray-900 hover:bg-gray-800 p-5 transition-colors"
            >
              <div className="text-sm font-semibold text-white mb-1.5 group-hover:text-blue-400 transition-colors">{label}</div>
              <div className="text-gray-500 text-xs leading-relaxed">{desc}</div>
            </button>
          ))}
        </div>

        {/* Auth */}
        <div className="border-t border-gray-800 pt-8">
          {user ? (
            <p className="text-gray-500 text-sm">
              Signed in as <span className="text-gray-300">{user.displayName || user.email}</span>
            </p>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <p className="text-gray-500 text-sm flex-1">
                Create an account to upload moments, sign guestbooks, and save collections.
              </p>
              <button
                onClick={onLoginClick}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors flex-shrink-0"
                style={{ borderRadius: '2px' }}
              >
                Sign in / Join
              </button>
            </div>
          )}
        </div>

        {/* About */}
        <div className="mt-10 border-t border-gray-800 pt-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { step: '01', title: 'Explore', body: 'Browse fan-recorded moments, setlists, and every song in the catalog.' },
            { step: '02', title: 'Upload', body: 'Attended a show? Share your clips and audio. Approved moments join the archive.' },
            { step: '03', title: 'Connect', body: 'Sign show guestbooks, chat before upcoming concerts, build playlists.' }
          ].map(({ step, title, body }) => (
            <div key={step}>
              <p className="text-gray-700 text-xs font-mono mb-2">{step}</p>
              <p className="text-gray-300 text-sm font-medium mb-1">{title}</p>
              <p className="text-gray-600 text-xs leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
LandingPageContent.displayName = 'LandingPageContent';

// Main Content Router Component
// Back to top floating button
const BackToTop = memo(() => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  if (!visible) return null;
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-24 right-4 sm:bottom-6 sm:right-6 z-40 w-10 h-10 bg-gray-800 border border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700 rounded-full shadow-lg flex items-center justify-center transition-colors"
      title="Back to top"
      aria-label="Scroll to top"
    >
      <ChevronUp size={18} />
    </button>
  );
});
BackToTop.displayName = 'BackToTop';

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
  autoplayPreviews,
  onShowAccount,
  onLoginClick,
  onViewUserProfile,
  initialMomentId,
  showLanding,
  onShowLanding,
  showLandingOverlay,
  setShowLandingOverlay
}) => {
  const [heroSelectedMoment, setHeroSelectedMoment] = useState(null);
  const contentSectionRef = useRef(null);
  const prevBrowseModeRef = useRef(browseMode);
  const navigate = useNavigate();
  const location = useLocation();

  // Theater queue for playlist import
  const { importPlaylistFromLink, playQueue } = useTheaterQueue();

  // Playlist import status
  const [playlistImportStatus, setPlaylistImportStatus] = useState(null); // { loading, success, error, name, count }

  // Scroll to content section when browse mode changes (user clicks tab)
  useEffect(() => {
    if (prevBrowseModeRef.current !== browseMode) {
      prevBrowseModeRef.current = browseMode;
      // Small delay to let content render
      setTimeout(() => {
        contentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [browseMode]);

  // Fetch and open moment when navigating directly to /moment/:id
  useEffect(() => {
    if (!initialMomentId || initialMomentId === heroSelectedMoment?._id) return;
    fetch(`${API_BASE_URL}/moments/${initialMomentId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?._id) setHeroSelectedMoment(data); })
      .catch(() => {});
  }, [initialMomentId]);

  // Push /moment/:id to URL when modal opens via click
  useEffect(() => {
    if (heroSelectedMoment?._id) {
      navigate(`/moment/${heroSelectedMoment._id}`, { replace: true });
    }
  }, [heroSelectedMoment?._id]);

  // Close modal when URL navigates away from /moment/:id (browser back button)
  useEffect(() => {
    if (heroSelectedMoment && !location.pathname.startsWith('/moment/')) {
      setHeroSelectedMoment(null);
    }
  }, [location.pathname]);

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

      {/* Media Filter Pills - Tablet only (shown only in browse mode) */}
      {!showLanding && <div className="hidden sm:flex lg:hidden justify-center mb-4">
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
      </div>}

      {/* VideoHero with Landing Page Overlay */}
      {showLanding ? (
        <div className="relative">
          {/* VideoHero — background video */}
          <VideoHero
            onMomentClick={(moment) => setHeroSelectedMoment(moment)}
            mediaFilters={mediaFilters}
            noAutoMinimize={showLanding}
          />

          {/* Landing page content overlay — absolute positioned over VideoHero */}
          {showLandingOverlay && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm overflow-y-auto pointer-events-auto transition-opacity duration-300">
              <LandingPageContent
                user={user}
                onNavigate={(mode) => onShowLanding?.(mode)}
                onLoginClick={onLoginClick}
                onToggleOverlay={() => setShowLandingOverlay(false)}
                overlayVisible={true}
              />
            </div>
          )}

          {/* Floating button to bring overlay back when hidden */}
          {!showLandingOverlay && (
            <button
              onClick={() => setShowLandingOverlay(true)}
              className="absolute top-3 right-3 z-50 bg-black/60 hover:bg-black/80 backdrop-blur-sm border border-white/20 rounded-full p-2.5 transition-all group"
              title="Show info"
            >
              <Eye size={18} className="text-white group-hover:text-blue-400 transition-colors" />
            </button>
          )}
        </div>
      ) : (
        /* Browse mode - VideoHero without overlay */
        <VideoHero
          onMomentClick={(moment) => setHeroSelectedMoment(moment)}
          mediaFilters={mediaFilters}
          noAutoMinimize={showLanding}
        />
      )}

      {!showLanding && <>
      {/* Scroll anchor for navigation clicks */}
      <div ref={contentSectionRef} className="scroll-mt-4" />

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
          autoplayPreviews={autoplayPreviews}
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
      </>}

      {/* Back to top button */}
      <BackToTop />

      {/* Modal for hero click */}
      {heroSelectedMoment && (
        <ModalErrorBoundary onClose={() => { setHeroSelectedMoment(null); navigate('/', { replace: true }); }}>
          <React.Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"><div className="text-white">Loading...</div></div>}>
            <MomentDetailModal
              moment={heroSelectedMoment}
              onClose={() => { setHeroSelectedMoment(null); navigate('/', { replace: true }); }}
              onViewUserProfile={onViewUserProfile}
            />
          </React.Suspense>
        </ModalErrorBoundary>
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
    currentQueueIndex,
    playQueue,
    clearQueue
  } = useTheaterQueue();

  return (
    <>
      {/* Mobile Mini Player - Above Bottom Nav - only when playing from queue (not hero autoplay) */}
      {isPlayingFromQueue && currentMoment && (
        <div className="sm:hidden fixed left-0 right-0 z-50" style={{ bottom: 'calc(52px + env(safe-area-inset-bottom, 0px))' }}>
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
              <button className="flex-1 min-w-0 text-left" onClick={() => setMobilePlayerExpanded(!mobilePlayerExpanded)}>
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">
                      {currentMoment.songName || 'Unknown'}
                    </div>
                    <div className="text-[10px] text-gray-400 truncate">
                      {currentMoment.venueName || currentMoment.venueCity || currentMoment.performanceDate || 'Live'}
                    </div>
                  </div>
                  {/* Queue position indicator */}
                  {theaterQueue.length > 0 && (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 rounded text-[10px] text-yellow-400 font-mono flex-shrink-0">
                      <ListMusic size={10} />
                      {currentQueueIndex + 1}/{theaterQueue.length}
                    </div>
                  )}
                </div>
              </button>

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

                {/* Queue section */}
                {theaterQueue.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <ListMusic size={12} className="text-yellow-400" />
                        <span>Queue ({theaterQueue.length})</span>
                      </div>
                      <button
                        onClick={clearQueue}
                        className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                        title="Clear queue"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {theaterQueue.slice(0, 5).map((item, idx) => (
                        <button
                          key={item._id || idx}
                          onClick={() => playQueue(idx)}
                          className={`w-full flex items-center gap-2 p-1.5 rounded text-left transition-colors ${
                            currentQueueIndex === idx
                              ? 'bg-yellow-500/20 border border-yellow-500/30'
                              : 'hover:bg-white/5'
                          }`}
                        >
                          <span className={`text-[10px] w-4 text-center ${currentQueueIndex === idx ? 'text-yellow-400' : 'text-gray-500'}`}>
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className={`text-xs truncate ${currentQueueIndex === idx ? 'text-white' : 'text-gray-300'}`}>
                              {item.songName}
                            </div>
                          </div>
                          {currentQueueIndex === idx && (
                            <Play size={10} className="text-yellow-400 flex-shrink-0" />
                          )}
                        </button>
                      ))}
                      {theaterQueue.length > 5 && (
                        <div className="text-[10px] text-gray-500 text-center py-1">
                          +{theaterQueue.length - 5} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
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