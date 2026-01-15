// src/components/User/UserProfile.jsx
import React, { useState, useEffect, memo } from 'react';
import { ArrowLeft, User, Calendar, Film, Eye, MessageSquare, Award, Music, Video, Link as LinkIcon } from 'lucide-react';
import { API_BASE_URL } from '../Auth/AuthProvider';

const UserProfile = memo(({ userId, onBack }) => {
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
          setStats(statsData);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-400">Loading profile...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors"
            style={{ minHeight: '44px' }}
          >
            <ArrowLeft size={20} />
            Back
          </button>
          <div className="text-center py-12">
            <User size={48} className="mx-auto text-gray-600 mb-4" />
            <h2 className="text-xl font-bold text-gray-300 mb-2">User Not Found</h2>
            <p className="text-gray-500">{error}</p>
          </div>
        </div>
      </div>
    );
  }

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

  if (stats?.firstCaptures >= 10) {
    badges.push({ icon: '🥇', label: 'Pioneer', color: 'bg-orange-500/20 text-orange-400' });
  }

  // Check for OG member (joined before 2025)
  if (profile?.memberSince) {
    const joinDate = new Date(profile.memberSince);
    if (joinDate < new Date('2025-01-01')) {
      badges.push({ icon: '👴', label: 'OG Member', color: 'bg-gray-500/20 text-gray-400' });
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors"
            style={{ minWidth: '44px', minHeight: '44px' }}
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold">User Profile</h1>
        </div>
      </div>

      {/* Profile Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Profile Header */}
        <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
              <User size={32} className="text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white mb-1">
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
                      className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 ${badge.color}`}
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
            <div className="mt-4 pt-4 border-t border-gray-800">
              <p className="text-gray-300">{profile.bio}</p>
            </div>
          )}

          {/* Social Links */}
          {profile?.socialLinks && Object.keys(profile.socialLinks).length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-800">
              <div className="flex flex-wrap gap-3">
                {profile.socialLinks.twitter && (
                  <a
                    href={`https://twitter.com/${profile.socialLinks.twitter}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300 transition-colors"
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
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300 transition-colors"
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
          <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Award size={20} className="text-yellow-400" />
              Contribution Stats
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                icon={<Film size={20} />}
                value={stats.totalUploads || 0}
                label="Uploads"
                color="text-blue-400"
              />
              <StatCard
                icon={<Eye size={20} />}
                value={formatNumber(stats.totalViews || 0)}
                label="Views"
                color="text-green-400"
              />
              <StatCard
                icon={<MessageSquare size={20} />}
                value={stats.totalCommentsReceived || 0}
                label="Comments"
                color="text-purple-400"
              />
              <StatCard
                icon={<Award size={20} />}
                value={stats.firstCaptures || 0}
                label="First Captures"
                color="text-yellow-400"
              />
            </div>

            {/* Media Breakdown */}
            {stats.mediaBreakdown && stats.mediaBreakdown.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-800">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Media Breakdown</h4>
                <div className="flex flex-wrap gap-3">
                  {stats.mediaBreakdown.map((item) => (
                    <div
                      key={item._id || 'unknown'}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded"
                    >
                      {item._id === 'video' ? (
                        <Video size={16} className="text-red-400" />
                      ) : (
                        <Music size={16} className="text-blue-400" />
                      )}
                      <span className="text-white font-medium">{item.count}</span>
                      <span className="text-gray-400 text-sm">{item._id || 'other'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rarity Breakdown */}
            {stats.rarityBreakdown && stats.rarityBreakdown.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-800">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Rarity Distribution</h4>
                <div className="flex flex-wrap gap-2">
                  {stats.rarityBreakdown.map((item) => (
                    <RarityBadge key={item._id} rarity={item._id} count={item.count} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

// Sub-components
const StatCard = memo(({ icon, value, label, color }) => (
  <div className="bg-gray-800/50 rounded-lg p-4 text-center">
    <div className={`flex justify-center mb-2 ${color}`}>{icon}</div>
    <div className="text-2xl font-bold text-white">{value}</div>
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
    <span className={`px-3 py-1 rounded border text-sm font-medium ${colorClass}`}>
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
