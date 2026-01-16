// src/components/User/UserProfile.jsx
import React, { useState, useEffect, memo } from 'react';
import { X, User, Calendar, Film, Eye, MessageSquare, Award, Music, Video, Link as LinkIcon } from 'lucide-react';
import { API_BASE_URL } from '../Auth/AuthProvider';

const UserProfile = memo(({ userId, onClose }) => {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUserData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch profile and stats in parallel
        const [profileRes, statsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/users/${userId}/profile`),
          fetch(`${API_BASE_URL}/api/users/${userId}/stats`)
        ]);

        if (!profileRes.ok) {
          throw new Error('User not found');
        }

        const profileData = await profileRes.json();
        setProfile(profileData.user);

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          // Backend returns { stats: {...} }, extract the stats object
          setStats(statsData.stats || statsData);
        }
      } catch (err) {
        setError(err.message || 'Failed to load user profile');
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchUserData();
    }
  }, [userId]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const memberSince = profile?.memberSince
    ? new Date(profile.memberSince).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : 'Unknown';

  // Calculate badges
  const badges = [];
  if (stats?.totalUploads >= 100) {
    badges.push({ icon: '🏆', label: 'Archive Hero', color: 'bg-yellow-500/20 text-yellow-400' });
  } else if (stats?.totalUploads >= 25) {
    badges.push({ icon: '🌟', label: 'Super Contributor', color: 'bg-purple-500/20 text-purple-400' });
  } else if (stats?.totalUploads >= 5) {
    badges.push({ icon: '⭐', label: 'Contributor', color: 'bg-blue-500/20 text-blue-400' });
  } else if (stats?.totalUploads >= 1) {
    badges.push({ icon: '🎬', label: 'First Upload', color: 'bg-green-500/20 text-green-400' });
  }

  // Check for OG member (joined before 2025)
  if (profile?.memberSince) {
    const joinDate = new Date(profile.memberSince);
    if (joinDate < new Date('2025-01-01')) {
      badges.push({ icon: '👴', label: 'OG Member', color: 'bg-gray-500/20 text-gray-400' });
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-white">User Profile</h1>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-white"
            style={{ minWidth: '40px', minHeight: '40px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-gray-400">Loading profile...</span>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <User size={48} className="mx-auto text-gray-600 mb-4" />
              <h2 className="text-xl font-bold text-gray-300 mb-2">User Not Found</h2>
              <p className="text-gray-500">{error}</p>
            </div>
          ) : (
            <>
              {/* Profile Header */}
              <div className="bg-gray-800/50 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <User size={28} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-white mb-1 truncate">
                      {profile?.displayName || 'Anonymous'}
                    </h2>
                    <div className="flex items-center gap-2 text-gray-400 text-sm mb-3">
                      <Calendar size={14} />
                      <span>Member since {memberSince}</span>
                    </div>

                    {/* Badges */}
                    {badges.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {badges.map((badge, idx) => (
                          <span
                            key={idx}
                            className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${badge.color}`}
                          >
                            <span>{badge.icon}</span>
                            {badge.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bio */}
                {profile?.bio && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <p className="text-gray-300 text-sm">{profile.bio}</p>
                  </div>
                )}

                {/* Social Links */}
                {profile?.socialLinks && Object.keys(profile.socialLinks).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <div className="flex flex-wrap gap-2">
                      {profile.socialLinks.twitter && (
                        <a
                          href={`https://twitter.com/${profile.socialLinks.twitter}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300 transition-colors"
                        >
                          <LinkIcon size={14} />
                          @{profile.socialLinks.twitter}
                        </a>
                      )}
                      {profile.socialLinks.instagram && (
                        <a
                          href={`https://instagram.com/${profile.socialLinks.instagram}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300 transition-colors"
                        >
                          <LinkIcon size={14} />
                          {profile.socialLinks.instagram}
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Stats Grid */}
              {stats && (
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                    <Award size={18} className="text-yellow-400" />
                    Contribution Stats
                  </h3>

                  <div className="grid grid-cols-3 gap-3">
                    <StatCard
                      icon={<Film size={18} />}
                      value={stats.totalUploads || 0}
                      label="Uploads"
                      color="text-blue-400"
                    />
                    <StatCard
                      icon={<Eye size={18} />}
                      value={formatNumber(stats.totalViews || 0)}
                      label="Views"
                      color="text-green-400"
                    />
                    <StatCard
                      icon={<MessageSquare size={18} />}
                      value={stats.totalCommentsReceived || 0}
                      label="Comments"
                      color="text-purple-400"
                    />
                  </div>

                  {/* Media Breakdown */}
                  {stats.mediaBreakdown && Object.keys(stats.mediaBreakdown).length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-700">
                      <h4 className="text-sm font-medium text-gray-400 mb-2">Media Breakdown</h4>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(stats.mediaBreakdown).map(([type, count]) => (
                          <div
                            key={type}
                            className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 rounded"
                          >
                            {type === 'video' ? (
                              <Video size={14} className="text-red-400" />
                            ) : (
                              <Music size={14} className="text-blue-400" />
                            )}
                            <span className="text-white font-medium text-sm">{count}</span>
                            <span className="text-gray-400 text-xs">{type}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Rarity Breakdown */}
                  {stats.rarityBreakdown && Object.keys(stats.rarityBreakdown).length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-700">
                      <h4 className="text-sm font-medium text-gray-400 mb-2">Rarity Distribution</h4>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(stats.rarityBreakdown).map(([rarity, count]) => (
                          <RarityBadge key={rarity} rarity={rarity} count={count} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
});

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

  const colorClass = colors[rarity] || colors.common;

  return (
    <span className={`px-2 py-0.5 rounded border text-xs font-medium ${colorClass}`}>
      {rarity}: {count}
    </span>
  );
});

RarityBadge.displayName = 'RarityBadge';

// Helper function
const formatNumber = (num) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

UserProfile.displayName = 'UserProfile';

export default UserProfile;
