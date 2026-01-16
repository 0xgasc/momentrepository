// src/components/UI/DesktopSidebar.jsx
// Sidebar for desktop - nav tabs, filters, queue preview
// Supports left, right, top, bottom positions
import React, { memo, useState } from 'react';
import {
  Film, Calendar, Music, Video, Link2, Upload,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
  ListMusic, Play, Pause, SkipBack, SkipForward, User, LogIn, Shield,
  Tv, Trash2, Trophy, Settings
} from 'lucide-react';
import { useTheaterQueue } from '../../contexts/TheaterQueueContext';
import TopContributors from '../Community/TopContributors';
import MediaControlCenter from './MediaControlCenter';

const DesktopSidebar = memo(({
  browseMode,
  onBrowseModeChange,
  mediaFilters,
  toggleFilter,
  user,
  onShowAccount,
  onAdminPanelClick,
  onLoginClick,
  isCollapsed,
  onToggleCollapse,
  onViewUserProfile,
  position = 'left',
  onShowSettings
}) => {
  const {
    theaterQueue, currentQueueIndex, isPlayingFromQueue, playQueue, clearQueue,
    currentMoment, playNextInQueue, playPrevInQueue
  } = useTheaterQueue();
  const [showContributors, setShowContributors] = useState(false);
  const [mediaControlDocked, setMediaControlDocked] = useState(true);
  const [showMediaControl, setShowMediaControl] = useState(true);

  const navItems = [
    { id: 'moments', label: 'Moments', icon: Film },
    { id: 'performances', label: 'Shows', icon: Calendar },
    { id: 'songs', label: 'Songs', icon: ListMusic },
  ];

  // Add UMOTube for admin/mod
  if (user && (user.role === 'admin' || user.role === 'mod')) {
    navItems.push({ id: 'umotube', label: 'Linked', icon: Tv });
  }

  const isHorizontal = position === 'top' || position === 'bottom';

  // Position-specific classes
  const getPositionClasses = () => {
    switch (position) {
      case 'left':
        return `left-0 top-0 h-screen flex-col ${isCollapsed ? 'w-16' : 'w-56'} border-r`;
      case 'right':
        return `right-0 top-0 h-screen flex-col ${isCollapsed ? 'w-16' : 'w-56'} border-l`;
      case 'top':
        return 'left-0 right-0 top-0 h-16 flex-row border-b';
      case 'bottom':
        return 'left-0 right-0 bottom-0 h-16 flex-row border-t';
      default:
        return 'left-0 top-0 h-screen flex-col w-56 border-r';
    }
  };

  // Toggle button position based on sidebar position
  const getTogglePosition = () => {
    switch (position) {
      case 'left':
        return '-right-3 top-20';
      case 'right':
        return '-left-3 top-20';
      case 'top':
        return 'left-1/2 -translate-x-1/2 -bottom-3';
      case 'bottom':
        return 'left-1/2 -translate-x-1/2 -top-3';
      default:
        return '-right-3 top-20';
    }
  };

  const getToggleIcon = () => {
    if (position === 'left') return isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />;
    if (position === 'right') return isCollapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />;
    if (position === 'top') return <ChevronUp size={14} />;
    if (position === 'bottom') return <ChevronDown size={14} />;
    return <ChevronLeft size={14} />;
  };

  // Horizontal layout (top/bottom)
  if (isHorizontal) {
    return (
      <div
        className={`hidden lg:flex fixed z-30 bg-gray-900/95 backdrop-blur-sm border-gray-700/50 transition-all duration-300 items-center px-4 gap-4 ${getPositionClasses()}`}
      >
        {/* Logo */}
        <h2 className="text-blue-400 font-bold text-sm whitespace-nowrap">UMO Archive</h2>

        {/* Divider */}
        <div className="w-px h-8 bg-gray-700/50" />

        {/* Navigation */}
        <div className="flex items-center gap-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = browseMode === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onBrowseModeChange(item.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-sm transition-all ${
                  isActive
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                }`}
                title={item.label}
              >
                <Icon size={16} className={isActive ? 'text-yellow-400' : ''} />
                <span className="text-xs font-medium hidden xl:inline">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-gray-700/50" />

        {/* Filters */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <button
              onClick={() => toggleFilter('type', 'audio')}
              title="Audio"
              className={`p-1.5 rounded-sm transition-all ${
                mediaFilters.audio
                  ? 'bg-blue-600/30 text-blue-400'
                  : 'text-gray-500 hover:bg-gray-800/50'
              }`}
            >
              <Music size={14} />
            </button>
            <button
              onClick={() => toggleFilter('type', 'video')}
              title="Video"
              className={`p-1.5 rounded-sm transition-all ${
                mediaFilters.video
                  ? 'bg-blue-600/30 text-blue-400'
                  : 'text-gray-500 hover:bg-gray-800/50'
              }`}
            >
              <Video size={14} />
            </button>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => toggleFilter('source', 'linked')}
              title="Linked"
              className={`p-1.5 rounded-sm transition-all ${
                mediaFilters.linked
                  ? 'bg-purple-600/30 text-purple-400'
                  : 'text-gray-500 hover:bg-gray-800/50'
              }`}
            >
              <Link2 size={14} />
            </button>
            <button
              onClick={() => toggleFilter('source', 'uploads')}
              title="Uploads"
              className={`p-1.5 rounded-sm transition-all ${
                mediaFilters.uploads
                  ? 'bg-purple-600/30 text-purple-400'
                  : 'text-gray-500 hover:bg-gray-800/50'
              }`}
            >
              <Upload size={14} />
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-gray-700/50" />

        {/* Now Playing Mini (horizontal) - click to open floating control */}
        {(isPlayingFromQueue || currentMoment) && currentMoment && (
          <>
            <button
              onClick={() => {
                setMediaControlDocked(false);
                setShowMediaControl(true);
              }}
              className="flex items-center gap-2 px-2 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/20 transition-colors"
              title="Open media controls"
            >
              <div className="flex items-end gap-0.5 h-3">
                <div className="w-0.5 bg-yellow-400 rounded-full animate-pulse" style={{ height: '6px' }} />
                <div className="w-0.5 bg-yellow-400 rounded-full animate-pulse" style={{ height: '10px', animationDelay: '150ms' }} />
                <div className="w-0.5 bg-yellow-400 rounded-full animate-pulse" style={{ height: '5px', animationDelay: '300ms' }} />
              </div>
              <div className="max-w-[120px] hidden xl:block">
                <div className="text-[10px] font-medium text-white truncate">{currentMoment.songName}</div>
              </div>
              <div className="flex items-center gap-1">
                <SkipBack size={12} className="text-gray-400" />
                <Play size={12} className="text-yellow-400" />
                <SkipForward size={12} className="text-gray-400" />
              </div>
            </button>
            <div className="w-px h-8 bg-gray-700/50" />
          </>
        )}

        {/* Floating Media Control for horizontal mode */}
        {showMediaControl && !mediaControlDocked && (isPlayingFromQueue || currentMoment) && (
          <MediaControlCenter
            isDocked={false}
            onDockChange={(docked) => {
              setMediaControlDocked(docked);
              // If docking from horizontal mode, just hide it
              if (docked) setShowMediaControl(false);
            }}
            onClose={() => setShowMediaControl(false)}
          />
        )}

        {/* Queue Count */}
        <div className={`flex items-center gap-2 ${theaterQueue.length > 0 ? 'text-yellow-400' : 'text-gray-500'}`}>
          <ListMusic size={16} />
          <span className="text-xs font-medium">{theaterQueue.length}</span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Settings Button */}
        <button
          onClick={onShowSettings}
          className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 rounded-sm transition-all"
          title="Settings"
        >
          <Settings size={14} />
        </button>

        {/* Account */}
        {user ? (
          <>
            <button
              onClick={onShowAccount}
              className="flex items-center gap-2 px-2 py-1.5 text-gray-400 hover:bg-gray-800/50 hover:text-white rounded-sm transition-all"
              title="My Account"
            >
              <User size={16} />
              <span className="text-xs hidden xl:inline">{user.displayName}</span>
            </button>
            {(user.role === 'admin' || user.role === 'mod') && (
              <button
                onClick={onAdminPanelClick}
                className="flex items-center gap-2 px-2 py-1.5 text-yellow-400 hover:bg-yellow-600/20 rounded-sm transition-all"
                title={user.role === 'admin' ? 'Admin Panel' : 'Mod Panel'}
              >
                <Shield size={16} />
              </button>
            )}
          </>
        ) : (
          <button
            onClick={onLoginClick}
            className="flex items-center gap-2 px-2 py-1.5 text-gray-400 hover:bg-blue-600/20 hover:text-blue-400 rounded-sm transition-all"
            title="Login"
          >
            <LogIn size={16} />
            <span className="text-xs hidden xl:inline">Login</span>
          </button>
        )}
      </div>
    );
  }

  // Vertical layout (left/right)
  return (
    <div
      className={`hidden lg:flex fixed z-30 bg-gray-900/95 backdrop-blur-sm border-gray-700/50 transition-all duration-300 ${getPositionClasses()}`}
    >
      {/* Toggle Button */}
      <button
        onClick={onToggleCollapse}
        className={`absolute ${getTogglePosition()} z-40 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-full p-1.5 transition-colors`}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <span className="text-gray-300">{getToggleIcon()}</span>
      </button>

      {/* Logo/Brand - only show when expanded */}
      {!isCollapsed && (
        <div className="p-4 border-b border-gray-700/50">
          <div className="flex items-center justify-between">
            <h2 className="text-blue-400 font-bold text-lg truncate">UMO Archive</h2>

            {/* Settings Button */}
            <button
              onClick={onShowSettings}
              className="p-1 text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 rounded-sm transition-all"
              title="Settings"
            >
              <Settings size={12} />
            </button>
          </div>

          {/* Collapsible Top Contributors */}
          <button
            onClick={() => setShowContributors(!showContributors)}
            className="flex items-center gap-2 mt-3 text-[10px] text-gray-500 hover:text-gray-300 transition-colors w-full"
          >
            <Trophy size={10} className="text-yellow-400" />
            <span>Top Contributors</span>
            <ChevronDown
              size={10}
              className={`ml-auto transition-transform ${showContributors ? 'rotate-180' : ''}`}
            />
          </button>
          {showContributors && (
            <div className="mt-2 max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700">
              <TopContributors onViewUserProfile={onViewUserProfile} compact />
            </div>
          )}
        </div>
      )}

      {/* Navigation Tabs */}
      <nav className="flex-shrink-0 p-2 border-b border-gray-700/50">
        {!isCollapsed && (
          <div className="text-[10px] uppercase tracking-wider text-gray-500 px-2 mb-2">
            Browse
          </div>
        )}
        <div className="space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = browseMode === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onBrowseModeChange(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-sm transition-all ${
                  isActive
                    ? `bg-yellow-500/20 text-yellow-400 ${position === 'left' ? 'border-l-2' : 'border-r-2'} border-yellow-400`
                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                } ${isCollapsed ? 'justify-center px-2' : ''}`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon size={18} className={isActive ? 'text-yellow-400' : ''} />
                {!isCollapsed && (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Media Filters */}
      <div className="flex-shrink-0 p-2 border-b border-gray-700/50">
        {!isCollapsed && (
          <div className="text-[10px] uppercase tracking-wider text-gray-500 px-2 mb-2">
            Filters
          </div>
        )}

        {/* Media Type */}
        <div className={`flex ${isCollapsed ? 'flex-col gap-1' : 'gap-1'} mb-2`}>
          <button
            onClick={() => toggleFilter('type', 'audio')}
            title="Audio"
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-sm transition-all ${
              mediaFilters.audio
                ? 'bg-blue-600/30 text-blue-400 border border-blue-500/50'
                : 'text-gray-500 hover:bg-gray-800/50 border border-transparent'
            } ${isCollapsed ? 'justify-center' : 'flex-1'}`}
          >
            <Music size={14} />
            {!isCollapsed && <span className="text-xs">Audio</span>}
          </button>
          <button
            onClick={() => toggleFilter('type', 'video')}
            title="Video"
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-sm transition-all ${
              mediaFilters.video
                ? 'bg-blue-600/30 text-blue-400 border border-blue-500/50'
                : 'text-gray-500 hover:bg-gray-800/50 border border-transparent'
            } ${isCollapsed ? 'justify-center' : 'flex-1'}`}
          >
            <Video size={14} />
            {!isCollapsed && <span className="text-xs">Video</span>}
          </button>
        </div>

        {/* Source Type */}
        <div className={`flex ${isCollapsed ? 'flex-col gap-1' : 'gap-1'}`}>
          <button
            onClick={() => toggleFilter('source', 'linked')}
            title="Linked"
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-sm transition-all ${
              mediaFilters.linked
                ? 'bg-purple-600/30 text-purple-400 border border-purple-500/50'
                : 'text-gray-500 hover:bg-gray-800/50 border border-transparent'
            } ${isCollapsed ? 'justify-center' : 'flex-1'}`}
          >
            <Link2 size={14} />
            {!isCollapsed && <span className="text-xs">Linked</span>}
          </button>
          <button
            onClick={() => toggleFilter('source', 'uploads')}
            title="Uploads"
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-sm transition-all ${
              mediaFilters.uploads
                ? 'bg-purple-600/30 text-purple-400 border border-purple-500/50'
                : 'text-gray-500 hover:bg-gray-800/50 border border-transparent'
            } ${isCollapsed ? 'justify-center' : 'flex-1'}`}
          >
            <Upload size={14} />
            {!isCollapsed && <span className="text-xs">Uploads</span>}
          </button>
        </div>
      </div>

      {/* Media Control Center - Docked */}
      {showMediaControl && mediaControlDocked && (isPlayingFromQueue || currentMoment) && !isCollapsed && (
        <div className="flex-shrink-0 border-b border-gray-700/50">
          <MediaControlCenter
            isDocked={true}
            onDockChange={(docked) => setMediaControlDocked(docked)}
            onClose={() => setShowMediaControl(false)}
          />
        </div>
      )}

      {/* Collapsed Now Playing indicator */}
      {(isPlayingFromQueue || currentMoment) && isCollapsed && (
        <div className="flex-shrink-0 p-2 border-b border-gray-700/50">
          <div className="flex flex-col items-center gap-1">
            <div className="w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center border border-yellow-500/30">
              <Play size={12} className="text-yellow-400 ml-0.5" />
            </div>
            <div className="flex items-end gap-0.5 h-2">
              <div className="w-0.5 bg-yellow-400 rounded-full animate-pulse" style={{ height: '4px' }} />
              <div className="w-0.5 bg-yellow-400 rounded-full animate-pulse" style={{ height: '8px', animationDelay: '150ms' }} />
              <div className="w-0.5 bg-yellow-400 rounded-full animate-pulse" style={{ height: '4px', animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}

      {/* Floating Media Control Center - when popped out */}
      {showMediaControl && !mediaControlDocked && (isPlayingFromQueue || currentMoment) && (
        <MediaControlCenter
          isDocked={false}
          onDockChange={(docked) => setMediaControlDocked(docked)}
          onClose={() => setShowMediaControl(false)}
        />
      )}

      {/* Queue Preview */}
      <div className="flex-1 overflow-hidden p-2">
        {!isCollapsed && (
          <div className="text-[10px] uppercase tracking-wider text-gray-500 px-2 mb-2 flex items-center justify-between">
            <span>Queue</span>
            <div className="flex items-center gap-2">
              {theaterQueue.length > 0 && (
                <>
                  <span className="text-yellow-400">{theaterQueue.length}</span>
                  <button
                    onClick={clearQueue}
                    className="text-gray-500 hover:text-red-400 transition-colors"
                    title="Clear queue"
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {isCollapsed ? (
          // Collapsed: Just show queue count
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded flex items-center justify-center ${
              theaterQueue.length > 0 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-800 text-gray-500'
            }`}>
              <ListMusic size={16} />
            </div>
            {theaterQueue.length > 0 && (
              <span className="text-[10px] text-yellow-400 mt-1">{theaterQueue.length}</span>
            )}
          </div>
        ) : (
          // Expanded: Show queue items
          <div className="space-y-1 overflow-y-auto max-h-[300px] scrollbar-thin scrollbar-thumb-gray-700">
            {theaterQueue.length === 0 ? (
              <div className="text-gray-500 text-xs text-center py-4">
                Queue empty<br />
                <span className="text-gray-600">Click + on moments to add</span>
              </div>
            ) : (
              theaterQueue.slice(0, 8).map((moment, idx) => (
                <button
                  key={moment._id || idx}
                  onClick={() => playQueue(idx)}
                  className={`w-full flex items-center gap-2 p-2 rounded-sm text-left transition-all ${
                    isPlayingFromQueue && currentQueueIndex === idx
                      ? 'bg-yellow-500/20 border border-yellow-500/50'
                      : 'hover:bg-gray-800/50'
                  }`}
                >
                  <div className="flex-shrink-0 w-6 h-6 bg-gray-800 rounded flex items-center justify-center">
                    {isPlayingFromQueue && currentQueueIndex === idx ? (
                      <Play size={10} className="text-yellow-400" />
                    ) : (
                      <span className="text-[10px] text-gray-500">{idx + 1}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white truncate">{moment.songName}</div>
                    <div className="text-[10px] text-gray-500 truncate">{moment.venueName}</div>
                  </div>
                </button>
              ))
            )}
            {theaterQueue.length > 8 && (
              <div className="text-[10px] text-gray-500 text-center py-1">
                +{theaterQueue.length - 8} more
              </div>
            )}
          </div>
        )}
      </div>

      {/* Account Section */}
      <div className="flex-shrink-0 p-2 border-t border-gray-700/50 space-y-1">
        {user ? (
          <>
            <button
              onClick={onShowAccount}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-gray-400 hover:bg-gray-800/50 hover:text-white transition-all ${
                isCollapsed ? 'justify-center px-2' : ''
              }`}
              title={isCollapsed ? 'Account' : undefined}
            >
              <User size={18} />
              {!isCollapsed && (
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-xs text-white truncate">{user.displayName}</div>
                  <div className="text-[10px] text-gray-500">My Account</div>
                </div>
              )}
            </button>
            {(user.role === 'admin' || user.role === 'mod') && (
              <button
                onClick={onAdminPanelClick}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-yellow-400 hover:bg-yellow-600/20 transition-all ${
                  isCollapsed ? 'justify-center px-2' : ''
                }`}
                title={isCollapsed ? (user.role === 'admin' ? 'Admin Panel' : 'Mod Panel') : undefined}
              >
                <Shield size={18} />
                {!isCollapsed && (
                  <span className="text-xs font-medium">{user.role === 'admin' ? 'Admin Panel' : 'Mod Panel'}</span>
                )}
              </button>
            )}
          </>
        ) : (
          <button
            onClick={onLoginClick}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-gray-400 hover:bg-blue-600/20 hover:text-blue-400 transition-all ${
              isCollapsed ? 'justify-center px-2' : ''
            }`}
            title={isCollapsed ? 'Login' : undefined}
          >
            <LogIn size={18} />
            {!isCollapsed && <span className="text-sm">Login</span>}
          </button>
        )}
      </div>
    </div>
  );
});

DesktopSidebar.displayName = 'DesktopSidebar';

export default DesktopSidebar;
