// src/components/User/UserProfile.jsx
import React, { useState, useEffect, useCallback, memo } from 'react';
import { X, User, Calendar, Film, Eye, MessageSquare, Award, Music, Video, Link as LinkIcon } from 'lucide-react';
import { API_BASE_URL } from '../Auth/AuthProvider';

const UserProfile = memo(({ userId, onClose, currentUserId, onPerformanceSelect, onMomentClick }) => {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Per-tab data
  const [tabData, setTabData] = useState({});
  const [tabLoading, setTabLoading] = useState({});

  const isOwnProfile = currentUserId && userId &&
    currentUserId.toString() === userId.toString();

  useEffect(() => {
    const fetchUserData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [profileRes, statsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/users/${userId}/profile`),
          fetch(`${API_BASE_URL}/api/users/${userId}/stats`)
        ]);
        if (!profileRes.ok) throw new Error('User not found');
        const profileData = await profileRes.json();
        setProfile(profileData.user);
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData.stats || statsData);
        }
      } catch (err) {
        setError(err.message || 'Failed to load user profile');
      } finally {
        setLoading(false);
      }
    };
    if (userId) fetchUserData();
  }, [userId]);

  // Escape key close
  useEffect(() => {
    const handleEscape = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Lazy-load tab data on first activation
  const fetchTab = useCallback(async (tab) => {
    if (tabData[tab] || tabLoading[tab]) return;
    setTabLoading(prev => ({ ...prev, [tab]: true }));
    try {
      const endpoints = {
        uploads: `${API_BASE_URL}/api/users/${userId}/moments`,
        comments: `${API_BASE_URL}/api/users/${userId}/comments`,
        shows: `${API_BASE_URL}/api/users/${userId}/rsvps`,
        guestbook: `${API_BASE_URL}/api/users/${userId}/guestbook`,
        favorites: `${API_BASE_URL}/api/users/${userId}/favorites`
      };
      const headers = tab === 'favorites'
        ? { Authorization: `Bearer ${localStorage.getItem('token')}` }
        : {};
      const res = await fetch(endpoints[tab], { headers });
      if (res.ok) {
        const data = await res.json();
        setTabData(prev => ({ ...prev, [tab]: data }));
      }
    } catch {
      // silent
    } finally {
      setTabLoading(prev => ({ ...prev, [tab]: false }));
    }
  }, [userId, tabData, tabLoading]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab !== 'overview') fetchTab(tab);
  };

  const memberSince = profile?.memberSince
    ? new Date(profile.memberSince).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Unknown';

  const badges = [];
  if (stats?.totalUploads >= 100) badges.push({ label: 'Archive Hero', color: 'bg-yellow-500/20 text-yellow-400' });
  else if (stats?.totalUploads >= 25) badges.push({ label: 'Super Contributor', color: 'bg-purple-500/20 text-purple-400' });
  else if (stats?.totalUploads >= 5) badges.push({ label: 'Contributor', color: 'bg-blue-500/20 text-blue-400' });
  else if (stats?.totalUploads >= 1) badges.push({ label: 'First Upload', color: 'bg-green-500/20 text-green-400' });
  if (profile?.memberSince && new Date(profile.memberSince) < new Date('2025-01-01')) {
    badges.push({ label: 'OG Member', color: 'bg-gray-500/20 text-gray-400' });
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'uploads', label: 'Uploads' },
    { id: 'comments', label: 'Comments' },
    { id: 'shows', label: 'Shows' },
    { id: 'guestbook', label: 'Guestbook' },
    ...(isOwnProfile ? [{ id: 'favorites', label: 'Favorites' }] : [])
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <h1 className="text-lg font-bold text-white">User Profile</h1>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-white"
            style={{ minWidth: '40px', minHeight: '40px' }}
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-gray-400">Loading profile...</span>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-12 p-4">
            <User size={48} className="mx-auto text-gray-600 mb-4" />
            <h2 className="text-xl font-bold text-gray-300 mb-2">User Not Found</h2>
            <p className="text-gray-500">{error}</p>
          </div>
        ) : (
          <>
            {/* Profile Header (always visible) */}
            <div className="px-4 pt-4 pb-3 flex-shrink-0">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <User size={28} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-white mb-1 truncate">
                      {profile?.displayName || 'Anonymous'}
                    </h2>
                    <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                      <Calendar size={14} />
                      <span>Member since {memberSince}</span>
                    </div>
                    {badges.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {badges.map((badge, idx) => (
                          <span key={idx} className={`px-2 py-0.5 rounded text-xs font-medium ${badge.color}`}>
                            {badge.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {profile?.bio && (
                  <p className="text-gray-300 text-sm mt-3 pt-3 border-t border-gray-700">{profile.bio}</p>
                )}
                {profile?.socialLinks && Object.keys(profile.socialLinks).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-700">
                    {profile.socialLinks.twitter && (
                      <a href={`https://twitter.com/${profile.socialLinks.twitter}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-300 transition-colors">
                        <LinkIcon size={12} />@{profile.socialLinks.twitter}
                      </a>
                    )}
                    {profile.socialLinks.instagram && (
                      <a href={`https://instagram.com/${profile.socialLinks.instagram}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-300 transition-colors">
                        <LinkIcon size={12} />{profile.socialLinks.instagram}
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-700 flex-shrink-0 overflow-x-auto scrollbar-none px-4">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'overview' && (
                <OverviewTab stats={stats} />
              )}
              {activeTab === 'uploads' && (
                <UploadsTab data={tabData.uploads} loading={tabLoading.uploads} onMomentClick={onMomentClick} onClose={onClose} />
              )}
              {activeTab === 'comments' && (
                <CommentsTab data={tabData.comments} loading={tabLoading.comments} onPerformanceSelect={onPerformanceSelect} onClose={onClose} />
              )}
              {activeTab === 'shows' && (
                <ShowsTab data={tabData.shows} loading={tabLoading.shows} onPerformanceSelect={onPerformanceSelect} onClose={onClose} />
              )}
              {activeTab === 'guestbook' && (
                <GuestbookTab data={tabData.guestbook} loading={tabLoading.guestbook} onPerformanceSelect={onPerformanceSelect} onClose={onClose} />
              )}
              {activeTab === 'favorites' && isOwnProfile && (
                <UploadsTab data={tabData.favorites ? { moments: tabData.favorites.favorites?.map(f => f.moment).filter(Boolean) } : null} loading={tabLoading.favorites} isFavorites onMomentClick={onMomentClick} onClose={onClose} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
});

// Overview tab — existing stats
const OverviewTab = memo(({ stats }) => {
  if (!stats) return <div className="text-gray-500 text-sm text-center py-8">No stats available.</div>;
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
          <Award size={18} className="text-yellow-400" />
          Contribution Stats
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={<Film size={18} />} value={stats.totalUploads || 0} label="Uploads" color="text-blue-400" />
          <StatCard icon={<Eye size={18} />} value={formatNumber(stats.totalViews || 0)} label="Views" color="text-green-400" />
          <StatCard icon={<MessageSquare size={18} />} value={stats.totalCommentsReceived || 0} label="Comments" color="text-purple-400" />
        </div>
      </div>
      {stats.mediaBreakdown && Object.keys(stats.mediaBreakdown).length > 0 && (
        <div className="pt-3 border-t border-gray-800">
          <h4 className="text-sm font-medium text-gray-400 mb-2">Media Breakdown</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.mediaBreakdown).map(([type, count]) => (
              <div key={type} className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 rounded">
                {type === 'video' ? <Video size={14} className="text-red-400" /> : <Music size={14} className="text-blue-400" />}
                <span className="text-white font-medium text-sm">{count}</span>
                <span className="text-gray-400 text-xs">{type}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {stats.rarityBreakdown && Object.keys(stats.rarityBreakdown).length > 0 && (
        <div className="pt-3 border-t border-gray-800">
          <h4 className="text-sm font-medium text-gray-400 mb-2">Rarity Distribution</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.rarityBreakdown).map(([rarity, count]) => (
              <RarityBadge key={rarity} rarity={rarity} count={count} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
OverviewTab.displayName = 'OverviewTab';

// Uploads/Favorites tab — grid of moments
const UploadsTab = memo(({ data, loading, isFavorites, onMomentClick, onClose }) => {
  if (loading) return <TabSpinner />;
  const moments = data?.moments || [];
  if (!moments.length) return (
    <div className="text-center py-10 text-gray-500 text-sm">
      {isFavorites ? 'No favorited moments yet.' : 'No approved uploads yet.'}
    </div>
  );

  const handleMomentClick = (moment) => {
    if (onMomentClick) {
      onMomentClick(moment);
      onClose?.();
    }
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {moments.map((m, i) => {
        if (!m) return null;

        // Debug: Log the first moment to see structure
        if (i === 0) {
          console.log('First moment data:', m);
          console.log('Thumbnail fields:', {
            thumbnailUrl: m.thumbnailUrl,
            thumbnail: m.thumbnail,
            thumbnailURL: m.thumbnailURL
          });
          console.log('Venue fields:', {
            venueName: m.venueName,
            'venue?.name': m.venue?.name,
            'performance?.venue?.name': m.performance?.venue?.name,
            'performance?.venueName': m.performance?.venueName,
            performanceId: m.performanceId
          });
        }

        // Handle different thumbnail field names
        const thumbnail = m.thumbnailUrl || m.thumbnail || m.thumbnailURL;

        // Handle different venue field structures
        const venue = m.venueName
          || m.venue?.name
          || m.performance?.venue?.name
          || m.performance?.venueName
          || (typeof m.performanceId === 'object' ? m.performanceId?.venue?.name || m.performanceId?.venueName : null);

        // Handle different date field structures
        const eventDate = m.eventDate
          || m.performance?.eventDate
          || (typeof m.performanceId === 'object' ? m.performanceId?.eventDate : null);

        return (
          <button
            key={m._id || i}
            onClick={() => handleMomentClick(m)}
            className="bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-700 transition-colors text-left"
          >
            {thumbnail ? (
              <img src={thumbnail} alt={m.title || 'Moment'} className="w-full aspect-video object-cover" loading="lazy" />
            ) : (
              <div className="w-full aspect-video bg-gray-700 flex items-center justify-center">
                {m.mediaType === 'audio' ? <Music size={24} className="text-gray-500" /> : <Video size={24} className="text-gray-500" />}
              </div>
            )}
            <div className="p-2 space-y-1">
              <p className="text-xs text-white font-medium truncate">{m.songName || m.title || 'Untitled'}</p>
              <p className="text-[10px] text-gray-500 truncate">{venue || 'Unknown venue'}</p>
              {eventDate && (
                <p className="text-[10px] text-gray-600">
                  {new Date(eventDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
});
UploadsTab.displayName = 'UploadsTab';

// Comments tab
const CommentsTab = memo(({ data, loading, onPerformanceSelect, onClose }) => {
  if (loading) return <TabSpinner />;
  const comments = data?.comments || [];
  if (!comments.length) return <div className="text-center py-10 text-gray-500 text-sm">No comments yet.</div>;
  return (
    <div className="space-y-2">
      {comments.map(c => (
        <div key={c._id} className="bg-gray-800/60 rounded p-3">
          <p className="text-sm text-gray-200 mb-1.5 line-clamp-3">{c.text}</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {c.performanceId ? 'on a show' : c.momentId ? 'on a moment' : ''}
            </span>
            <span className="text-xs text-gray-600">{new Date(c.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      ))}
    </div>
  );
});
CommentsTab.displayName = 'CommentsTab';

// Shows (RSVPs) tab
const ShowsTab = memo(({ data, loading, onPerformanceSelect, onClose }) => {
  if (loading) return <TabSpinner />;
  const rsvps = data?.rsvps || [];
  if (!rsvps.length) return <div className="text-center py-10 text-gray-500 text-sm">No RSVPs yet.</div>;
  return (
    <div className="space-y-2">
      {rsvps.map(r => {
        const perf = r.performanceId;
        const perfId = typeof perf === 'object' ? perf?._id : perf;
        const venue = typeof perf === 'object' ? (perf?.venue?.name || perf?.venueName || '') : '';
        const date = typeof perf === 'object' && perf?.eventDate
          ? new Date(perf.eventDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
          : new Date(r.createdAt).toLocaleDateString();
        return (
          <button
            key={r._id}
            onClick={() => { onPerformanceSelect?.({ id: perfId }); onClose?.(); }}
            className="w-full text-left bg-gray-800/60 rounded p-3 hover:bg-gray-700/60 transition-colors"
          >
            <p className="text-sm text-white">{venue || 'Show'}</p>
            {r.message && <p className="text-xs text-gray-400 mt-0.5 truncate italic">{r.message}</p>}
            <p className="text-xs text-gray-600 mt-1">{date}</p>
          </button>
        );
      })}
    </div>
  );
});
ShowsTab.displayName = 'ShowsTab';

// Guestbook tab
const GuestbookTab = memo(({ data, loading, onPerformanceSelect, onClose }) => {
  if (loading) return <TabSpinner />;
  const signatures = data?.signatures || [];
  if (!signatures.length) return <div className="text-center py-10 text-gray-500 text-sm">No guestbook entries yet.</div>;
  return (
    <div className="space-y-2">
      {signatures.map(sig => {
        const perf = sig.performanceId;
        const perfId = typeof perf === 'object' ? perf?._id : perf;
        const venue = typeof perf === 'object' ? (perf?.venue?.name || perf?.venueName || '') : '';
        return (
          <div key={sig._id} className="bg-gray-800/60 rounded p-3">
            {sig.message && <p className="text-sm text-gray-200 mb-1.5 italic">"{sig.message}"</p>}
            <div className="flex items-center justify-between">
              {sig.performanceId && (
                <button
                  onClick={() => { onPerformanceSelect?.({ id: perfId }); onClose?.(); }}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {venue || 'View show'}
                </button>
              )}
              <span className="text-xs text-gray-600 ml-auto">{new Date(sig.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
});
GuestbookTab.displayName = 'GuestbookTab';

// Spinner for tab loading
const TabSpinner = () => (
  <div className="flex justify-center py-10">
    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

// Sub-components
const StatCard = memo(({ icon, value, label, color }) => (
  <div className="bg-gray-700/50 rounded-lg p-3 text-center">
    <div className={`flex justify-center mb-1 ${color}`}>{icon}</div>
    <div className="text-xl font-bold text-white">{value}</div>
    <div className="text-xs text-gray-400">{label}</div>
  </div>
));
StatCard.displayName = 'StatCard';

const RarityBadge = memo(({ rarity, count }) => {
  const colors = {
    legendary: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    epic: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    rare: 'bg-red-500/20 text-red-400 border-red-500/30',
    uncommon: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    common: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  };
  return (
    <span className={`px-2 py-0.5 rounded border text-xs font-medium ${colors[rarity] || colors.common}`}>
      {rarity}: {count}
    </span>
  );
});
RarityBadge.displayName = 'RarityBadge';

const formatNumber = (num) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

UserProfile.displayName = 'UserProfile';

export default UserProfile;
