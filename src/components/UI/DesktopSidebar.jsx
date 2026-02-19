// src/components/UI/DesktopSidebar.jsx
// Horizontal top/bottom bar for desktop navigation
import React, { memo, useState } from 'react';
import {
  Film, Calendar, Music, Video, Link2, Upload,
  ChevronDown,
  ListMusic, Play, Pause, SkipBack, SkipForward, Shuffle, User, LogIn, Shield,
  Tv, Trophy, Settings, Volume2, VolumeX
} from 'lucide-react';
import { useTheaterQueue } from '../../contexts/TheaterQueueContext';
import TopContributors from '../Community/TopContributors';
import MediaControlCenter from './MediaControlCenter';
import NotificationBell from './NotificationBell';

const DesktopSidebar = memo(({
  browseMode,
  onBrowseModeChange,
  mediaFilters,
  toggleFilter,
  user,
  onShowAccount,
  onAdminPanelClick,
  onLoginClick,
  onViewUserProfile,
  position = 'top',
  onShowSettings,
  onToggleHowToGuide,
  onShowLanding,
  autoplayPreviews = true,
  onToggleAutoplay
}) => {
  const {
    theaterQueue, currentQueueIndex, isPlayingFromQueue,
    currentMoment, playNextInQueue, playPrevInQueue,
    togglePlayPause, playerState, toggleMute, setVolume, playRandom
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

  const positionClasses = position === 'bottom'
    ? 'left-0 right-0 bottom-0 h-16 flex-row border-t'
    : 'left-0 right-0 top-0 h-16 flex-row border-b';

  return (
    <div
      className={`hidden lg:flex fixed z-30 bg-gray-900/95 backdrop-blur-sm border-gray-700/50 transition-all duration-300 items-center px-4 gap-4 ${positionClasses}`}
    >
      {/* Logo */}
      <button onClick={onShowLanding} className="text-blue-400 hover:text-blue-300 font-bold text-sm whitespace-nowrap transition-colors" title="UMO Archive home">UMO Archive</button>

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

      {/* Now Playing Mini - WORKING CONTROLS */}
      {(isPlayingFromQueue || currentMoment) && currentMoment && (
        <>
          <div className="flex items-center gap-1.5 px-2 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded">
            {/* Song name - clickable to expand MediaControlCenter */}
            <button
              onClick={() => { setMediaControlDocked(false); setShowMediaControl(true); }}
              className="max-w-[100px] hidden xl:block hover:text-yellow-400 transition-colors"
              title="Open full controls"
            >
              <div className="text-[10px] font-medium text-white truncate">{currentMoment.songName}</div>
            </button>

            {/* Play/Pause */}
            <button
              onClick={(e) => { e.stopPropagation(); togglePlayPause(); }}
              className="p-1 rounded bg-yellow-500/20 hover:bg-yellow-500/40 transition-colors"
              title={playerState.isPlaying ? 'Pause' : 'Play'}
            >
              {playerState.isPlaying ? <Pause size={12} className="text-yellow-400" /> : <Play size={12} className="text-yellow-400 ml-0.5" />}
            </button>

            {/* Previous / Restart */}
            <button onClick={() => playPrevInQueue()} className="p-1 hover:bg-gray-700/50 rounded transition-colors" title="Previous">
              <SkipBack size={12} className="text-gray-400 hover:text-white" />
            </button>
            {/* Smart Next: shows Next if queue has more, else Random */}
            {theaterQueue.length > 0 && currentQueueIndex < theaterQueue.length - 1 ? (
              <button onClick={() => playNextInQueue()} className="p-1 hover:bg-gray-700/50 rounded transition-colors" title="Next in queue">
                <SkipForward size={12} className="text-gray-400 hover:text-white" />
              </button>
            ) : (
              <button onClick={() => playRandom()} className="p-1 hover:bg-gray-700/50 rounded transition-colors" title="Play random">
                <Shuffle size={12} className="text-gray-400 hover:text-white" />
              </button>
            )}

            {/* Volume control */}
            <div className="flex items-center gap-1">
              <button onClick={() => toggleMute()} className="p-1 hover:bg-gray-700/50 rounded transition-colors">
                {playerState.isMuted ? <VolumeX size={12} className="text-orange-400" /> : <Volume2 size={12} className="text-gray-400" />}
              </button>
              <input
                type="range" min="0" max="1" step="0.05"
                value={playerState.isMuted ? 0 : (playerState.volume || 1)}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-12 h-1 accent-yellow-500"
              />
            </div>

            {/* Expand button for full controls */}
            <button
              onClick={() => { setMediaControlDocked(false); setShowMediaControl(true); }}
              className="p-1 text-gray-500 hover:text-white transition-colors"
              title="More controls"
            >
              <ChevronDown size={12} />
            </button>
          </div>
          <div className="w-px h-8 bg-gray-700/50" />
        </>
      )}

      {/* Floating Media Control */}
      {showMediaControl && !mediaControlDocked && (isPlayingFromQueue || currentMoment) && (
        <MediaControlCenter
          isDocked={false}
          onDockChange={(docked) => {
            setMediaControlDocked(docked);
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

      {/* Top Contributors */}
      <div className="relative">
        <button
          onClick={() => setShowContributors(!showContributors)}
          className={`p-1.5 rounded-sm transition-all ${showContributors ? 'bg-yellow-600/20 text-yellow-400' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'}`}
          title="Top Contributors"
        >
          <Trophy size={14} />
        </button>
        {showContributors && (
          <div className="absolute right-0 top-full mt-2 w-72 bg-gray-900 border border-gray-700 rounded-sm shadow-xl z-50 p-3">
            <div className="flex items-center gap-2 mb-2 text-xs text-gray-400 font-medium">
              <Trophy size={12} className="text-yellow-400" />
              Top Contributors
            </div>
            <div className="max-h-60 overflow-y-auto">
              <TopContributors onViewUserProfile={onViewUserProfile} compact />
            </div>
          </div>
        )}
      </div>

      {/* Autoplay preview toggle */}
      <button
        onClick={onToggleAutoplay}
        className={`p-1.5 rounded-sm transition-all ${autoplayPreviews ? 'text-blue-400 bg-blue-600/20' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'}`}
        title={autoplayPreviews ? 'Previews: on (click to disable autoplay)' : 'Previews: off (click to enable autoplay)'}
      >
        <Play size={14} />
      </button>

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
          <NotificationBell />
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
});

DesktopSidebar.displayName = 'DesktopSidebar';

export default DesktopSidebar;
