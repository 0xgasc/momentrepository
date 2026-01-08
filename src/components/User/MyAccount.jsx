// src/components/User/MyAccount.jsx
import React, { useState, useEffect, memo, useCallback } from 'react';
import { Upload, Eye, MessageCircle, Star, Heart, Folder, Plus, Trash2 } from 'lucide-react';
import { useAuth, API_BASE_URL } from '../Auth/AuthProvider';
import { useUserStats } from '../../hooks/useUserStats';
import { useFavorites } from '../../hooks/useFavorites';
import { transformMediaUrl } from '../../utils/mediaUrl';

const MyAccount = memo(({ onClose }) => {
  // eslint-disable-next-line no-unused-vars
  const { user, token, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [myMoments, setMyMoments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');

  const fetchAccountData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch profile
      const profileResponse = await fetch(`${API_BASE_URL}/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        setProfile(profileData.user);
      }
      
      // Fetch user's moments with status
      const momentsResponse = await fetch(`${API_BASE_URL}/moments/my-status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (momentsResponse.ok) {
        const momentsData = await momentsResponse.json();
        setMyMoments(momentsData.moments);
      }
      
    } catch (error) {
      console.error('❌ Account data fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAccountData();
  }, [fetchAccountData]);

  const getRoleDisplay = (role) => {
    const roleInfo = {
      admin: { label: 'Administrator', color: 'text-purple-600' },
      mod: { label: 'Moderator', color: 'text-blue-600' },
      user: { label: 'User', color: 'text-gray-600' }
    };
    return roleInfo[role] || roleInfo.user;
  };

  const getStatusDisplay = (status) => {
    const statusInfo = {
      pending: { label: 'Pending Review', color: 'text-yellow-600 bg-yellow-50' },
      approved: { label: 'Approved', color: 'text-green-600 bg-green-50' },
      rejected: { label: 'Rejected', color: 'text-red-600 bg-red-50' },
      needs_revision: { label: 'Needs Revision', color: 'text-orange-600 bg-orange-50' }
    };
    return statusInfo[status] || statusInfo.pending;
  };

  const groupMomentsByStatus = (moments) => {
    return moments.reduce((groups, moment) => {
      const status = moment.approvalStatus || 'pending';
      if (!groups[status]) groups[status] = [];
      groups[status].push(moment);
      return groups;
    }, {});
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style={{ zIndex: 9999 }}>
        <div className="bg-white rounded-sm p-8 max-w-md border border-gray-300">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <div className="text-center mt-4">Loading account...</div>
        </div>
      </div>
    );
  }

  const roleDisplay = getRoleDisplay(profile?.role);
  const groupedMoments = groupMomentsByStatus(myMoments);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" style={{ zIndex: 9999 }}>
      <div className="bg-white rounded-sm shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-gray-300" style={{ backgroundColor: 'white' }}>
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b flex items-center justify-between" style={{ backgroundColor: '#f9fafb' }}>
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900">My Account</h2>
              <p className="text-sm text-gray-600">{profile?.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          {[
            { key: 'profile', label: 'Profile', count: null },
            { key: 'favorites', label: 'Favorites', count: null, icon: Heart },
            { key: 'uploads', label: 'My Uploads', count: myMoments.length },
            { key: 'pending', label: 'Pending', count: groupedMoments.pending?.length || 0 },
            { key: 'needs_revision', label: 'Needs Revision', count: groupedMoments.needs_revision?.length || 0 },
            { key: 'approved', label: 'Approved', count: groupedMoments.approved?.length || 0 }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {tab.count !== null && tab.count > 0 && (
                <span className="ml-2 bg-gray-200 text-gray-700 rounded-full px-2 py-1 text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[70vh] bg-white" style={{ backgroundColor: 'white' }}>
          {activeTab === 'profile' && (
            <ProfileTab profile={profile} roleDisplay={roleDisplay} logout={logout} onClose={onClose} />
          )}

          {activeTab === 'favorites' && (
            <FavoritesTab />
          )}

          {activeTab === 'uploads' && (
            <UploadsTab moments={myMoments} getStatusDisplay={getStatusDisplay} formatDate={formatDate} />
          )}
          
          {activeTab === 'pending' && (
            <StatusTab 
              moments={groupedMoments.pending || []} 
              status="pending"
              getStatusDisplay={getStatusDisplay} 
              formatDate={formatDate} 
            />
          )}
          
          {activeTab === 'needs_revision' && (
            <StatusTab 
              moments={groupedMoments.needs_revision || []} 
              status="needs_revision"
              getStatusDisplay={getStatusDisplay} 
              formatDate={formatDate} 
            />
          )}
          
          {activeTab === 'approved' && (
            <StatusTab 
              moments={groupedMoments.approved || []} 
              status="approved"
              getStatusDisplay={getStatusDisplay} 
              formatDate={formatDate} 
            />
          )}
        </div>
      </div>
    </div>
  );
});

// Stat card component
const StatCard = memo(({ label, value, icon: Icon, color = 'blue' }) => {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-600',
    green: 'bg-green-50 border-green-200 text-green-600',
    purple: 'bg-purple-50 border-purple-200 text-purple-600',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-600'
  };

  return (
    <div className={`p-4 rounded-sm border ${colorClasses[color]} flex items-center gap-3`}>
      <div className="p-2 bg-white rounded-full shadow-sm">
        <Icon size={20} />
      </div>
      <div>
        <div className="text-2xl font-bold">{value ?? '-'}</div>
        <div className="text-sm opacity-80">{label}</div>
      </div>
    </div>
  );
});

StatCard.displayName = 'StatCard';

// Favorites tab component
const FavoritesTab = memo(() => {
  const { token } = useAuth();
  const {
    favorites,
    collections,
    loading,
    toggleFavorite,
    createCollection,
    deleteCollection,
    fetchFavorites
  } = useFavorites(token);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [selectedCollection, setSelectedCollection] = useState(null);

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;
    const result = await createCollection(newCollectionName.trim());
    if (result.success) {
      setNewCollectionName('');
      setShowCreateModal(false);
    }
  };

  const handleDeleteCollection = async (collectionId) => {
    if (!window.confirm('Delete this collection? Moments will be kept in your favorites.')) return;
    await deleteCollection(collectionId);
  };

  const handleRemoveFavorite = async (momentId) => {
    await toggleFavorite(momentId);
  };

  const filteredFavorites = selectedCollection
    ? favorites.filter(f => f.collectionRef === selectedCollection)
    : favorites;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Collections Section */}
      <div className="bg-gray-50 rounded-sm p-4 border border-gray-200" style={{ backgroundColor: '#f9fafb' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Folder size={18} />
            Collections
          </h3>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            <Plus size={14} />
            New Collection
          </button>
        </div>

        {collections.length === 0 ? (
          <p className="text-sm text-gray-500">No collections yet. Create one to organize your favorites!</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCollection(null)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                !selectedCollection
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              All ({favorites.length})
            </button>
            {collections.map(col => (
              <div key={col._id} className="relative group">
                <button
                  onClick={() => setSelectedCollection(col._id)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    selectedCollection === col._id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {col.name} ({col.momentCount})
                </button>
                <button
                  onClick={() => handleDeleteCollection(col._id)}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Create collection modal */}
        {showCreateModal && (
          <div className="mt-3 p-3 bg-white border rounded">
            <input
              type="text"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              placeholder="Collection name..."
              className="w-full p-2 border border-gray-300 rounded text-sm mb-2"
              maxLength={100}
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreateCollection}
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Create
              </button>
              <button
                onClick={() => { setShowCreateModal(false); setNewCollectionName(''); }}
                className="px-3 py-1.5 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Favorites Grid */}
      <div className="bg-gray-50 rounded-sm p-4 border border-gray-200" style={{ backgroundColor: '#f9fafb' }}>
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-3">
          <Heart size={18} className="text-red-500" />
          Favorited Moments ({filteredFavorites.length})
        </h3>

        {filteredFavorites.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <Heart size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              {selectedCollection
                ? 'No moments in this collection yet'
                : 'No favorited moments yet. Click the heart on any moment to add it here!'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {filteredFavorites.map(fav => (
              <div key={fav._id} className="relative group bg-white rounded border overflow-hidden">
                <div className="aspect-video bg-gray-800 flex items-center justify-center">
                  {fav.moment?.thumbnailUrl || fav.moment?.mediaUrl ? (
                    <img
                      src={transformMediaUrl(fav.moment.thumbnailUrl || fav.moment.mediaUrl)}
                      alt={fav.moment.songName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-gray-500 text-2xl">🎵</span>
                  )}
                </div>
                <div className="p-2">
                  <p className="font-medium text-sm text-gray-900 truncate">{fav.moment?.songName}</p>
                  <p className="text-xs text-gray-500 truncate">{fav.moment?.venueName}</p>
                </div>
                <button
                  onClick={() => handleRemoveFavorite(fav.moment?._id)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove from favorites"
                >
                  <Heart size={12} fill="currentColor" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

FavoritesTab.displayName = 'FavoritesTab';

// Profile tab component with social links
const ProfileTab = memo(({ profile, roleDisplay, logout, onClose }) => {
  const { token, user } = useAuth();
  const { stats, loading: statsLoading, fetchStats } = useUserStats(user?.id || user?._id);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedProfile, setEditedProfile] = useState({
    displayName: profile?.displayName || '',
    bio: profile?.bio || '',
    socialLinks: {
      reddit: profile?.socialLinks?.reddit || '',
      discord: profile?.socialLinks?.discord || '',
      instagram: profile?.socialLinks?.instagram || '',
      twitter: profile?.socialLinks?.twitter || '',
      whatsapp: profile?.socialLinks?.whatsapp || ''
    }
  });

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      const response = await fetch(`${API_BASE_URL}/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editedProfile)
      });

      if (response.ok) {
        setIsEditing(false);
        window.location.reload();
      } else {
        alert('Failed to save profile');
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  // Fetch stats on mount
  useEffect(() => {
    if (user?.id || user?._id) {
      fetchStats();
    }
  }, [user, fetchStats]);

  const socialPlatforms = [
    { key: 'reddit', label: 'Reddit', placeholder: 'u/username or profile URL' },
    { key: 'discord', label: 'Discord', placeholder: 'Username#1234 or server invite' },
    { key: 'instagram', label: 'Instagram', placeholder: '@username or profile URL' },
    { key: 'twitter', label: 'X/Twitter', placeholder: '@username or profile URL' },
    { key: 'whatsapp', label: 'WhatsApp', placeholder: 'Phone number or group link' }
  ];

  return (
    <div className="space-y-6">
      {/* Stats Section */}
      <div className="bg-gray-50 rounded-sm p-4 border border-gray-200" style={{ backgroundColor: '#f9fafb', border: '1px solid #d1d5db' }}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4" style={{ color: '#111827' }}>Your Stats</h3>
        {statsLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Uploads" value={stats?.totalUploads || 0} icon={Upload} color="blue" />
            <StatCard label="Views Received" value={stats?.totalViews || 0} icon={Eye} color="green" />
            <StatCard label="Comments" value={stats?.totalCommentsReceived || 0} icon={MessageCircle} color="purple" />
            <StatCard label="First Captures" value={stats?.firstCaptures || 0} icon={Star} color="yellow" />
          </div>
        )}
      </div>

      {/* Account Info Section */}
      <div className="bg-gray-50 rounded-sm p-4 border border-gray-200" style={{ backgroundColor: '#f9fafb', border: '1px solid #d1d5db' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900" style={{ color: '#111827' }}>Account Information</h3>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Edit Profile
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <div className="text-gray-900">{profile?.email}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
            {isEditing ? (
              <input
                type="text"
                value={editedProfile.displayName}
                onChange={(e) => setEditedProfile({ ...editedProfile, displayName: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded text-sm"
                placeholder="Your display name"
                maxLength={50}
              />
            ) : (
              <div className="text-gray-900">{profile?.displayName || 'Not set'}</div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <div className={`flex items-center gap-2 ${roleDisplay.color}`}>
              <span className="font-medium">{roleDisplay.label}</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Member Since</label>
            <div className="text-gray-900">
              {new Date(profile?.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Active</label>
            <div className="text-gray-900">
              {new Date(profile?.lastActive).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>
          {profile?.roleAssignedAt && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role Assigned</label>
              <div className="text-gray-900">
                {new Date(profile.roleAssignedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
            </div>
          )}
        </div>

        {/* Bio Section */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
          {isEditing ? (
            <textarea
              value={editedProfile.bio}
              onChange={(e) => setEditedProfile({ ...editedProfile, bio: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded text-sm"
              placeholder="Tell other fans about yourself..."
              rows={3}
              maxLength={500}
            />
          ) : (
            <div className="text-gray-900 text-sm">
              {profile?.bio || <span className="text-gray-400 italic">No bio set</span>}
            </div>
          )}
        </div>
      </div>

      {/* Social Links Section */}
      <div className="bg-gray-50 rounded-sm p-4 border border-gray-200" style={{ backgroundColor: '#f9fafb', border: '1px solid #d1d5db' }}>
        <h3 className="text-lg font-semibold mb-4 text-gray-900" style={{ color: '#111827' }}>
          Social Links
          <span className="text-sm font-normal text-gray-500 ml-2">Connect with other fans</span>
        </h3>

        <div className="space-y-3">
          {socialPlatforms.map(({ key, label, placeholder }) => (
            <div key={key} className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700 w-24">{label}</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedProfile.socialLinks[key]}
                  onChange={(e) => setEditedProfile({
                    ...editedProfile,
                    socialLinks: { ...editedProfile.socialLinks, [key]: e.target.value }
                  })}
                  className="flex-1 p-2 border border-gray-300 rounded text-sm"
                  placeholder={placeholder}
                  maxLength={200}
                />
              ) : (
                <div className="flex-1 text-gray-900 text-sm">
                  {profile?.socialLinks?.[key] ? (
                    <span className="text-blue-600">{profile.socialLinks[key]}</span>
                  ) : (
                    <span className="text-gray-400 italic">Not set</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Save/Cancel buttons when editing */}
        {isEditing && (
          <div className="flex gap-3 mt-6 pt-4 border-t">
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setEditedProfile({
                  displayName: profile?.displayName || '',
                  bio: profile?.bio || '',
                  socialLinks: {
                    reddit: profile?.socialLinks?.reddit || '',
                    discord: profile?.socialLinks?.discord || '',
                    instagram: profile?.socialLinks?.instagram || '',
                    twitter: profile?.socialLinks?.twitter || '',
                    whatsapp: profile?.socialLinks?.whatsapp || ''
                  }
                });
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded-sm hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Logout Button */}
      <div className="bg-gray-50 rounded-sm p-4 border border-gray-200" style={{ backgroundColor: '#f9fafb', border: '1px solid #d1d5db' }}>
        <button
          onClick={() => {
            logout();
            onClose();
          }}
          className="w-full px-4 py-2 bg-red-600 text-white rounded-sm hover:bg-red-700 transition-colors"
        >
          Logout
        </button>
      </div>
    </div>
  );
});

// Uploads tab component
const UploadsTab = memo(({ moments, getStatusDisplay, formatDate }) => {
  const [editingMoment, setEditingMoment] = useState(null);
  const [editedMetadata, setEditedMetadata] = useState({});
  const [isDeleting, setIsDeleting] = useState(null);
  const { token } = useAuth();
  
  const handleEditMetadata = (moment) => {
    setEditingMoment(moment._id);
    setEditedMetadata({
      momentDescription: moment.momentDescription || '',
      personalNote: moment.personalNote || '',
      emotionalTags: moment.emotionalTags || '',
      specialOccasion: moment.specialOccasion || '',
      audioQuality: moment.audioQuality || 'good',
      videoQuality: moment.videoQuality || 'good',
      instruments: moment.instruments || '',
      guestAppearances: moment.guestAppearances || '',
      crowdReaction: moment.crowdReaction || '',
      uniqueElements: moment.uniqueElements || ''
    });
  };
  
  const saveMetadata = async (momentId) => {
    try {
      // Send metadata as-is since backend will handle string conversion
      const response = await fetch(`${API_BASE_URL}/moments/${momentId}/metadata`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editedMetadata)
      });
      
      if (response.ok) {
        console.log('✅ Metadata updated');
        window.location.reload();
      } else {
        console.error('❌ Failed to update metadata');
        alert('Failed to update metadata');
      }
    } catch (error) {
      console.error('❌ Update error:', error);
      alert('Failed to update metadata');
    }
    setEditingMoment(null);
  };
  
  const withdrawSubmission = async (momentId) => {
    if (!window.confirm('Are you sure you want to withdraw this submission? This cannot be undone.')) {
      return;
    }
    
    try {
      setIsDeleting(momentId);
      const response = await fetch(`${API_BASE_URL}/moments/${momentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        console.log('✅ Submission withdrawn');
        // Refresh the page to show updated data
        window.location.reload();
      } else {
        console.error('❌ Failed to withdraw submission');
        alert('Failed to withdraw submission');
      }
    } catch (error) {
      console.error('❌ Delete error:', error);
      alert('Failed to withdraw submission');
    }
    setIsDeleting(null);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">All My Uploads ({moments.length})</h3>
      {moments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">📤</div>
          <div>No uploads yet</div>
          <div className="text-sm">Upload your first moment to get started!</div>
        </div>
      ) : (
        <div className="space-y-3">
          {moments.map(moment => {
            const statusDisplay = getStatusDisplay(moment.approvalStatus);
            const isPending = moment.approvalStatus === 'pending' || moment.approvalStatus === 'needs_revision';
            const isEditing = editingMoment === moment._id;
            const isDeleting_this = isDeleting === moment._id;
            
            return (
              <div key={moment._id} className="border border-gray-200 rounded-sm p-4 bg-white">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{moment.songName}</h4>
                    <p className="text-sm text-gray-600">
                      {moment.venueName}, {moment.venueCity} • {formatDate(moment.performanceDate)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Uploaded {formatDate(moment.createdAt)}
                    </p>
                    
                    {/* Metadata editing */}
                    {isEditing ? (
                      <div className="mt-2 p-3 bg-gray-50 rounded border">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Description:
                            </label>
                            <textarea
                              value={editedMetadata.momentDescription}
                              onChange={(e) => setEditedMetadata({...editedMetadata, momentDescription: e.target.value})}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                              rows="2"
                              placeholder="Describe this moment..."
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Personal Note:
                            </label>
                            <textarea
                              value={editedMetadata.personalNote}
                              onChange={(e) => setEditedMetadata({...editedMetadata, personalNote: e.target.value})}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                              rows="2"
                              placeholder="Personal notes about this moment..."
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Emotional Tags:
                            </label>
                            <input
                              type="text"
                              value={editedMetadata.emotionalTags}
                              onChange={(e) => setEditedMetadata({...editedMetadata, emotionalTags: e.target.value})}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                              placeholder="emotional, energetic, nostalgic (comma-separated)"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Special Occasion:
                            </label>
                            <input
                              type="text"
                              value={editedMetadata.specialOccasion}
                              onChange={(e) => setEditedMetadata({...editedMetadata, specialOccasion: e.target.value})}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                              placeholder="birthday, anniversary, etc."
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Audio Quality:
                            </label>
                            <select
                              value={editedMetadata.audioQuality}
                              onChange={(e) => setEditedMetadata({...editedMetadata, audioQuality: e.target.value})}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                            >
                              <option value="poor">Poor</option>
                              <option value="fair">Fair</option>
                              <option value="good">Good</option>
                              <option value="excellent">Excellent</option>
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Video Quality:
                            </label>
                            <select
                              value={editedMetadata.videoQuality}
                              onChange={(e) => setEditedMetadata({...editedMetadata, videoQuality: e.target.value})}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                            >
                              <option value="poor">Poor</option>
                              <option value="fair">Fair</option>
                              <option value="good">Good</option>
                              <option value="excellent">Excellent</option>
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Instruments:
                            </label>
                            <input
                              type="text"
                              value={editedMetadata.instruments}
                              onChange={(e) => setEditedMetadata({...editedMetadata, instruments: e.target.value})}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                              placeholder="guitar, piano, drums (comma-separated)"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Guest Appearances:
                            </label>
                            <input
                              type="text"
                              value={editedMetadata.guestAppearances}
                              onChange={(e) => setEditedMetadata({...editedMetadata, guestAppearances: e.target.value})}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                              placeholder="artist names (comma-separated)"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Crowd Reaction:
                            </label>
                            <input
                              type="text"
                              value={editedMetadata.crowdReaction}
                              onChange={(e) => setEditedMetadata({...editedMetadata, crowdReaction: e.target.value})}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                              placeholder="wild, singing along, silent..."
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Unique Elements:
                            </label>
                            <input
                              type="text"
                              value={editedMetadata.uniqueElements}
                              onChange={(e) => setEditedMetadata({...editedMetadata, uniqueElements: e.target.value})}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                              placeholder="extended solo, different arrangement (comma-separated)"
                            />
                          </div>
                        </div>
                        
                        <div className="flex gap-2 mt-3 pt-3 border-t">
                          <button
                            onClick={() => saveMetadata(moment._id)}
                            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
                          >
                            Save All Changes
                          </button>
                          <button
                            onClick={() => setEditingMoment(null)}
                            className="bg-gray-500 text-white px-4 py-2 rounded text-sm hover:bg-gray-600"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${statusDisplay.color}`}>
                      {statusDisplay.label}
                    </div>
                    
                    {/* Action buttons for pending moments */}
                    {isPending && !isEditing && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEditMetadata(moment)}
                          className="bg-gray-600 text-white px-2 py-1 rounded text-xs hover:bg-gray-700"
                          title="Edit metadata"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => withdrawSubmission(moment._id)}
                          disabled={isDeleting_this}
                          className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700 disabled:opacity-50"
                          title="Withdraw submission"
                        >
                          {isDeleting_this ? '...' : '🗑️ Withdraw'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                {moment.rejectionReason && (
                  <div className={`mt-2 p-2 rounded text-sm ${
                    moment.approvalStatus === 'needs_revision' 
                      ? 'bg-orange-50 border border-orange-200 text-orange-700'
                      : 'bg-red-50 border border-red-200 text-red-700'
                  }`}>
                    <strong>
                      {moment.approvalStatus === 'needs_revision' ? 'Moderator feedback:' : 'Rejection reason:'}
                    </strong> {moment.rejectionReason}
                  </div>
                )}
                
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

// Status-specific tab component
const StatusTab = memo(({ moments, status, getStatusDisplay, formatDate }) => {
  const statusDisplay = getStatusDisplay(status);
  const [editingMoment, setEditingMoment] = useState(null);
  const [editedMetadata, setEditedMetadata] = useState({});
  const [isDeleting, setIsDeleting] = useState(null);
  const { token } = useAuth();
  
  const handleEditMetadata = (moment) => {
    setEditingMoment(moment._id);
    setEditedMetadata({
      momentDescription: moment.momentDescription || '',
      personalNote: moment.personalNote || '',
      emotionalTags: moment.emotionalTags || '',
      specialOccasion: moment.specialOccasion || '',
      audioQuality: moment.audioQuality || 'good',
      videoQuality: moment.videoQuality || 'good',
      instruments: moment.instruments || '',
      guestAppearances: moment.guestAppearances || '',
      crowdReaction: moment.crowdReaction || '',
      uniqueElements: moment.uniqueElements || ''
    });
  };
  
  const saveMetadata = async (momentId) => {
    try {
      // Send metadata as-is since backend will handle string conversion
      const response = await fetch(`${API_BASE_URL}/moments/${momentId}/metadata`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editedMetadata)
      });
      
      if (response.ok) {
        console.log('✅ Metadata updated');
        window.location.reload();
      } else {
        console.error('❌ Failed to update metadata');
        alert('Failed to update metadata');
      }
    } catch (error) {
      console.error('❌ Update error:', error);
      alert('Failed to update metadata');
    }
    setEditingMoment(null);
  };
  
  const withdrawSubmission = async (momentId) => {
    if (!window.confirm('Are you sure you want to withdraw this submission? This cannot be undone.')) {
      return;
    }
    
    try {
      setIsDeleting(momentId);
      const response = await fetch(`${API_BASE_URL}/moments/${momentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        console.log('✅ Submission withdrawn');
        window.location.reload();
      } else {
        console.error('❌ Failed to withdraw submission');
        alert('Failed to withdraw submission');
      }
    } catch (error) {
      console.error('❌ Delete error:', error);
      alert('Failed to withdraw submission');
    }
    setIsDeleting(null);
  };
  
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        {statusDisplay.label} Uploads ({moments.length})
      </h3>
      
      {moments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="text-lg font-semibold mb-2">{statusDisplay.label}</div>
          <div>No {status} uploads</div>
        </div>
      ) : (
        <div className="space-y-3">
          {moments.map(moment => {
            const isPending = status === 'pending' || status === 'needs_revision';
            const isEditing = editingMoment === moment._id;
            const isDeleting_this = isDeleting === moment._id;
            
            return (
              <div key={moment._id} className="border border-gray-200 rounded-sm p-4 bg-white">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{moment.songName}</h4>
                    <p className="text-sm text-gray-600">
                      {moment.venueName}, {moment.venueCity} • {formatDate(moment.performanceDate)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Uploaded {formatDate(moment.createdAt)}
                      {moment.reviewedAt && (
                        <span> • Reviewed {formatDate(moment.reviewedAt)}</span>
                      )}
                    </p>
                    
                    {/* Metadata editing */}
                    {isEditing ? (
                      <div className="mt-2 p-3 bg-gray-50 rounded border">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Description:
                            </label>
                            <textarea
                              value={editedMetadata.momentDescription}
                              onChange={(e) => setEditedMetadata({...editedMetadata, momentDescription: e.target.value})}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                              rows="2"
                              placeholder="Describe this moment..."
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Personal Note:
                            </label>
                            <textarea
                              value={editedMetadata.personalNote}
                              onChange={(e) => setEditedMetadata({...editedMetadata, personalNote: e.target.value})}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                              rows="2"
                              placeholder="Personal notes about this moment..."
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Emotional Tags:
                            </label>
                            <input
                              type="text"
                              value={editedMetadata.emotionalTags}
                              onChange={(e) => setEditedMetadata({...editedMetadata, emotionalTags: e.target.value})}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                              placeholder="emotional, energetic, nostalgic (comma-separated)"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Special Occasion:
                            </label>
                            <input
                              type="text"
                              value={editedMetadata.specialOccasion}
                              onChange={(e) => setEditedMetadata({...editedMetadata, specialOccasion: e.target.value})}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                              placeholder="birthday, anniversary, etc."
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Audio Quality:
                            </label>
                            <select
                              value={editedMetadata.audioQuality}
                              onChange={(e) => setEditedMetadata({...editedMetadata, audioQuality: e.target.value})}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                            >
                              <option value="poor">Poor</option>
                              <option value="fair">Fair</option>
                              <option value="good">Good</option>
                              <option value="excellent">Excellent</option>
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Video Quality:
                            </label>
                            <select
                              value={editedMetadata.videoQuality}
                              onChange={(e) => setEditedMetadata({...editedMetadata, videoQuality: e.target.value})}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                            >
                              <option value="poor">Poor</option>
                              <option value="fair">Fair</option>
                              <option value="good">Good</option>
                              <option value="excellent">Excellent</option>
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Instruments:
                            </label>
                            <input
                              type="text"
                              value={editedMetadata.instruments}
                              onChange={(e) => setEditedMetadata({...editedMetadata, instruments: e.target.value})}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                              placeholder="guitar, piano, drums (comma-separated)"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Guest Appearances:
                            </label>
                            <input
                              type="text"
                              value={editedMetadata.guestAppearances}
                              onChange={(e) => setEditedMetadata({...editedMetadata, guestAppearances: e.target.value})}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                              placeholder="artist names (comma-separated)"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Crowd Reaction:
                            </label>
                            <input
                              type="text"
                              value={editedMetadata.crowdReaction}
                              onChange={(e) => setEditedMetadata({...editedMetadata, crowdReaction: e.target.value})}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                              placeholder="wild, singing along, silent..."
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Unique Elements:
                            </label>
                            <input
                              type="text"
                              value={editedMetadata.uniqueElements}
                              onChange={(e) => setEditedMetadata({...editedMetadata, uniqueElements: e.target.value})}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                              placeholder="extended solo, different arrangement (comma-separated)"
                            />
                          </div>
                        </div>
                        
                        <div className="flex gap-2 mt-3 pt-3 border-t">
                          <button
                            onClick={() => saveMetadata(moment._id)}
                            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
                          >
                            Save All Changes
                          </button>
                          <button
                            onClick={() => setEditingMoment(null)}
                            className="bg-gray-500 text-white px-4 py-2 rounded text-sm hover:bg-gray-600"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    {/* Action buttons for pending moments */}
                    {isPending && !isEditing && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEditMetadata(moment)}
                          className="bg-gray-600 text-white px-2 py-1 rounded text-xs hover:bg-gray-700"
                          title="Edit metadata"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => withdrawSubmission(moment._id)}
                          disabled={isDeleting_this}
                          className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700 disabled:opacity-50"
                          title="Withdraw submission"
                        >
                          {isDeleting_this ? '...' : '🗑️ Withdraw'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                {moment.rejectionReason && (
                  <div className={`mt-2 p-2 rounded text-sm ${
                    moment.approvalStatus === 'needs_revision' 
                      ? 'bg-orange-50 border border-orange-200 text-orange-700'
                      : 'bg-red-50 border border-red-200 text-red-700'
                  }`}>
                    <strong>
                      {moment.approvalStatus === 'needs_revision' ? 'Moderator feedback:' : 'Rejection reason:'}
                    </strong> {moment.rejectionReason}
                  </div>
                )}
                
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

ProfileTab.displayName = 'ProfileTab';
UploadsTab.displayName = 'UploadsTab';
StatusTab.displayName = 'StatusTab';
MyAccount.displayName = 'MyAccount';

export default MyAccount;