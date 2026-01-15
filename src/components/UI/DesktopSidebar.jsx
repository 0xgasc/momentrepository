// src/components/UI/DesktopSidebar.jsx
// Left sidebar for desktop - nav tabs, filters, queue preview
import React, { useState, memo } from 'react';
import {
  Film, Calendar, Music, Video, Link2, Upload,
  ChevronLeft, ChevronRight, ListMusic, Play, User, LogIn,
  Tv
} from 'lucide-react';
import { useTheaterQueue } from '../../contexts/TheaterQueueContext';

const DesktopSidebar = memo(({
  browseMode,
  onBrowseModeChange,
  mediaFilters,
  toggleFilter,
  user,
  onShowAccount,
  onLoginClick
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { theaterQueue, currentQueueIndex, isPlayingFromQueue, playQueue } = useTheaterQueue();

  const navItems = [
    { id: 'moments', label: 'Moments', icon: Film },
    { id: 'performances', label: 'Shows', icon: Calendar },
    { id: 'songs', label: 'Songs', icon: Music },
  ];

  // Add UMOTube for admin/mod
  if (user && (user.role === 'admin' || user.role === 'mod')) {
    navItems.push({ id: 'umotube', label: 'Linked', icon: Tv });
  }

  return (
    <div
      className={`hidden lg:flex flex-col h-screen fixed left-0 top-0 z-30 bg-gray-900/95 backdrop-blur-sm border-r border-gray-700/50 transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-56'
      }`}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-20 z-40 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-full p-1.5 transition-colors"
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? (
          <ChevronRight size={14} className="text-gray-300" />
        ) : (
          <ChevronLeft size={14} className="text-gray-300" />
        )}
      </button>

      {/* Logo/Brand */}
      <div className={`p-4 border-b border-gray-700/50 ${isCollapsed ? 'px-2' : ''}`}>
        {isCollapsed ? (
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded flex items-center justify-center">
            <span className="text-white font-bold text-lg">U</span>
          </div>
        ) : (
          <h2 className="text-blue-400 font-bold text-lg truncate">UMO Archive</h2>
        )}
      </div>

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
                    ? 'bg-yellow-500/20 text-yellow-400 border-l-2 border-yellow-400'
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

      {/* Queue Preview */}
      <div className="flex-1 overflow-hidden p-2">
        {!isCollapsed && (
          <div className="text-[10px] uppercase tracking-wider text-gray-500 px-2 mb-2 flex items-center justify-between">
            <span>Queue</span>
            {theaterQueue.length > 0 && (
              <span className="text-yellow-400">{theaterQueue.length}</span>
            )}
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
      <div className="flex-shrink-0 p-2 border-t border-gray-700/50">
        {user ? (
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
