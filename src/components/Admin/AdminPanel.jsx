// src/components/Admin/AdminPanel.jsx
import React, { useState, useEffect, memo, useCallback } from 'react';
import { useAuth, API_BASE_URL } from '../Auth/AuthProvider';
import { useCacheStatus } from '../../hooks';

// Constants
const REFRESH_DELAY_MS = 1500;

const AdminPanel = memo(({ onClose }) => {
  const { token, user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.email === 'solo@solo.solo' || user?.email === 'solo2@solo.solo';
  const isMod = user?.role === 'mod';
  const [activeTab, setActiveTab] = useState(isAdmin ? 'users' : 'moderation');
  const [users, setUsers] = useState([]);
  const [pendingMoments, setPendingMoments] = useState([]);
  const [platformSettings, setPlatformSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAdminData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      // Fetch users (only for admins)
      if (isAdmin) {
        const usersResponse = await fetch(`${API_BASE_URL}/admin/users`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          setUsers(usersData.users);
        } else if (usersResponse.status === 403) {
          setError('Access denied: Admin privileges required');
          return;
        }
      }
      
      // Fetch pending moments
      const momentsResponse = await fetch(`${API_BASE_URL}/moderation/pending`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (momentsResponse.ok) {
        const momentsData = await momentsResponse.json();
        setPendingMoments(momentsData.moments);
      }
      
      // Fetch platform settings
      const settingsResponse = await fetch(`${API_BASE_URL}/admin/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        setPlatformSettings(settingsData.settings);
      }
      
    } catch (error) {
      setError('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, [token, isAdmin]);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  const assignRole = async (userId, newRole) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: newRole })
      });
      
      if (response.ok) {
        await response.json();
        
        // Update users list
        setUsers(users.map(user => 
          user._id === userId 
            ? { ...user, role: newRole, roleAssignedAt: new Date().toISOString() }
            : user
        ));
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to assign role');
      }
    } catch (error) {
      setError('Failed to assign role');
    }
  };

  const approveMoment = async (momentId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/moderation/moments/${momentId}/approve`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        console.log('✅ Moment approved');
        setPendingMoments(pendingMoments.filter(m => m._id !== momentId));
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to approve moment');
      }
    } catch (error) {
      console.error('❌ Approval error:', error);
      setError('Failed to approve moment');
    }
  };

  const rejectMoment = async (momentId, reason) => {
    try {
      const response = await fetch(`${API_BASE_URL}/moderation/moments/${momentId}/reject`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      });
      
      if (response.ok) {
        console.log('✅ Moment rejected and deleted');
        setPendingMoments(pendingMoments.filter(m => m._id !== momentId));
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to reject moment');
      }
    } catch (error) {
      console.error('❌ Rejection error:', error);
      setError('Failed to reject moment');
    }
  };

  const getRoleDisplay = (role) => {
    const roleInfo = {
      admin: { label: 'Administrator', color: 'text-purple-600' },
      mod: { label: 'Moderator', color: 'text-blue-600' },
      user: { label: 'User', color: 'text-gray-600' }
    };
    return roleInfo[role] || roleInfo.user;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <div className="text-center mt-4">Loading admin panel...</div>
        </div>
      </div>
    );
  }

  if (error && error.includes('Access denied')) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md text-center">
          <div className="text-red-500 text-6xl mb-4">🚫</div>
          <div className="text-xl font-bold text-gray-800 mb-2">Access Denied</div>
          <div className="text-gray-600 mb-4">Administrator privileges required</div>
          <button
            onClick={onClose}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden border border-gray-300" style={{ backgroundColor: 'white' }}>
        {/* Header */}
        <div className="bg-gray-100 px-6 py-4 border-b border-gray-300 flex items-center justify-between" style={{ backgroundColor: '#e5e7eb' }}>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Admin Panel</h2>
            <p className="text-sm text-gray-600">User management & content moderation</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Error Display */}
        {error && !error.includes('Access denied') && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <div className="text-red-700">{error}</div>
            <button
              onClick={() => setError('')}
              className="text-red-500 hover:text-red-700 text-sm mt-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b">
          {[
            ...(isAdmin ? [{ key: 'users', label: 'Users', count: users.length }] : []),
            { key: 'moderation', label: 'Pending Review', count: pendingMoments.length },
            ...(isAdmin ? [{ key: 'settings', label: 'Settings', count: null }] : [])
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-purple-500 text-purple-600 bg-purple-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-2 bg-gray-200 text-gray-700 rounded-full px-2 py-1 text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[70vh] bg-white">
{activeTab === 'users' && isAdmin && (
            <UsersTab 
              users={users} 
              assignRole={assignRole}
              getRoleDisplay={getRoleDisplay}
              formatDate={formatDate}
            />
          )}
          
          {activeTab === 'moderation' && (
            <ModerationTab 
              pendingMoments={pendingMoments}
              approveMoment={approveMoment}
              rejectMoment={rejectMoment}
              formatDate={formatDate}
            />
          )}
          
          {activeTab === 'settings' && isAdmin && (
            <SettingsTab 
              platformSettings={platformSettings}
              setPlatformSettings={setPlatformSettings}
              token={token}
            />
          )}
        </div>
      </div>
    </div>
  );
});

// Users management tab
const UsersTab = memo(({ users, assignRole, getRoleDisplay, formatDate }) => {
  const [selectedUser, setSelectedUser] = useState(null);
  const [newRole, setNewRole] = useState('');

  const roleStats = users.reduce((stats, user) => {
    stats[user.role] = (stats[user.role] || 0) + 1;
    return stats;
  }, {});

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(roleStats).map(([role, count]) => {
          const roleDisplay = getRoleDisplay(role);
          return (
            <div key={role} className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <div>
                  <div className="font-medium">{count}</div>
                  <div className={`text-sm ${roleDisplay.color}`}>{roleDisplay.label}s</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Users List */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">All Users ({users.length})</h3>
        {users.map(user => {
          const roleDisplay = getRoleDisplay(user.role);
          return (
            <div key={user._id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div>
                      <h4 className="font-medium text-gray-900">{user.displayName || user.email}</h4>
                      <p className="text-sm text-gray-600">{user.email}</p>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${roleDisplay.color} bg-gray-100`}>
                      {roleDisplay.label}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>Joined: {formatDate(user.createdAt)}</div>
                    <div>Last active: {formatDate(user.lastActive)}</div>
                    {user.roleAssignedAt && (
                      <div>Role assigned: {formatDate(user.roleAssignedAt)}</div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <select
                    value={selectedUser === user._id ? newRole : user.role}
                    onChange={(e) => {
                      setSelectedUser(user._id);
                      setNewRole(e.target.value);
                    }}
                    className="text-sm border border-gray-300 rounded px-2 py-1"
                  >
                    <option value="user">User</option>
                    <option value="mod">Moderator</option>
                    <option value="admin">Administrator</option>
                  </select>
                  
                  {selectedUser === user._id && newRole !== user.role && (
                    <button
                      onClick={() => {
                        assignRole(user._id, newRole);
                        setSelectedUser(null);
                        setNewRole('');
                      }}
                      className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700"
                    >
                      Update
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// Content moderation tab
const ModerationTab = memo(({ pendingMoments, approveMoment, rejectMoment, formatDate }) => {
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectingMoment, setRejectingMoment] = useState(null);
  const [expandedMoment, setExpandedMoment] = useState(null);
  const [editingMoment, setEditingMoment] = useState(null);
  const [editedMetadata, setEditedMetadata] = useState({});
  const { token } = useAuth();

  const handleReject = (momentId) => {
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }
    rejectMoment(momentId, rejectionReason);
    setRejectionReason('');
    setRejectingMoment(null);
  };
  
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
  
  const sendBackForReview = async (momentId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/moderation/moments/${momentId}/send-back`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...editedMetadata,
          moderatorNote: 'Please review the suggested changes to your moment metadata.'
        })
      });
      
      if (response.ok) {
        console.log('✅ Sent back for review');
        window.location.reload();
      } else {
        console.error('❌ Failed to send back for review');
        alert('Failed to send back for review');
      }
    } catch (error) {
      console.error('❌ Send back error:', error);
      alert('Failed to send back for review');
    }
    setEditingMoment(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Pending Content Review ({pendingMoments.length})</h3>
        {pendingMoments.length > 0 && (
          <div className="text-sm text-gray-600">
            Review content uploaded by users before it becomes public
          </div>
        )}
      </div>

      {pendingMoments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">✅</div>
          <div>No pending content</div>
          <div className="text-sm">All uploads have been reviewed!</div>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingMoments.map(moment => (
            <div key={moment._id} className="border border-gray-200 rounded-lg p-4 bg-yellow-50">
              <div className="flex items-start gap-4">
                {/* Media Preview */}
                {moment.mediaUrl && (
                  <div className="flex-shrink-0">
                    {moment.mediaType === 'video' ? (
                      <video
                        src={moment.mediaUrl}
                        className="w-32 h-24 object-cover rounded border"
                        controls
                        preload="metadata"
                      />
                    ) : moment.mediaType === 'image' ? (
                      <img
                        src={moment.mediaUrl}
                        alt="Moment preview"
                        className="w-32 h-24 object-cover rounded border"
                      />
                    ) : (
                      <div className="w-32 h-24 bg-gray-200 rounded border flex items-center justify-center">
                        <span className="text-gray-500 text-xs">Audio</span>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Content Info */}
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{moment.songName}</h4>
                  <p className="text-sm text-gray-600">
                    {moment.venueName}, {moment.venueCity} • {formatDate(moment.performanceDate)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Uploaded by {moment.user?.displayName || moment.user?.email} on {formatDate(moment.createdAt)}
                  </p>
                  
                  {moment.momentDescription && (
                    <p className="text-sm text-gray-700 mt-2 bg-white p-2 rounded border">
                      "{moment.momentDescription}"
                    </p>
                  )}
                  
                  {/* Expand/Collapse metadata button */}
                  <div className="mt-2">
                    <button
                      onClick={() => setExpandedMoment(expandedMoment === moment._id ? null : moment._id)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      {expandedMoment === moment._id ? '▼ Hide Metadata' : '▶ Show All Metadata'}
                    </button>
                  </div>
                  
                  {/* Expanded metadata view */}
                  {expandedMoment === moment._id && (
                    <div className="mt-3 p-3 bg-gray-50 rounded border">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><strong>Description:</strong> {moment.momentDescription || 'None'}</div>
                        <div><strong>Personal Note:</strong> {moment.personalNote || 'None'}</div>
                        <div><strong>Audio Quality:</strong> {moment.audioQuality || 'good'}</div>
                        <div><strong>Video Quality:</strong> {moment.videoQuality || 'good'}</div>
                        <div><strong>Special Occasion:</strong> {moment.specialOccasion || 'None'}</div>
                        <div><strong>Emotional Tags:</strong> {moment.emotionalTags || 'None'}</div>
                        <div><strong>Instruments:</strong> {moment.instruments || 'None'}</div>
                        <div><strong>Guest Appearances:</strong> {moment.guestAppearances || 'None'}</div>
                        <div><strong>Crowd Reaction:</strong> {moment.crowdReaction || 'None'}</div>
                        <div><strong>Unique Elements:</strong> {moment.uniqueElements || 'None'}</div>
                        <div className="col-span-2"><strong>Moment Type:</strong> {moment.momentType || 'performance'}</div>
                        <div className="col-span-2"><strong>Content Type:</strong> {moment.contentType || 'song'}</div>
                      </div>
                      
                      {!editingMoment && (
                        <button
                          onClick={() => handleEditMetadata(moment)}
                          className="mt-3 bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                        >
                          ✏️ Edit Metadata
                        </button>
                      )}
                    </div>
                  )}
                  
                  {/* Metadata editing form */}
                  {editingMoment === moment._id && (
                    <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
                      <h4 className="font-medium text-gray-900 mb-3">Edit Metadata (changes will be applied and sent back to uploader)</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Description:</label>
                          <textarea
                            value={editedMetadata.momentDescription}
                            onChange={(e) => setEditedMetadata({...editedMetadata, momentDescription: e.target.value})}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            rows="2"
                            placeholder="Describe this moment..."
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Personal Note:</label>
                          <textarea
                            value={editedMetadata.personalNote}
                            onChange={(e) => setEditedMetadata({...editedMetadata, personalNote: e.target.value})}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            rows="2"
                            placeholder="Personal notes about this moment..."
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Emotional Tags:</label>
                          <input
                            type="text"
                            value={editedMetadata.emotionalTags}
                            onChange={(e) => setEditedMetadata({...editedMetadata, emotionalTags: e.target.value})}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            placeholder="emotional, energetic, nostalgic (comma-separated)"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Special Occasion:</label>
                          <input
                            type="text"
                            value={editedMetadata.specialOccasion}
                            onChange={(e) => setEditedMetadata({...editedMetadata, specialOccasion: e.target.value})}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            placeholder="birthday, anniversary, etc."
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Audio Quality:</label>
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
                          <label className="block text-sm font-medium text-gray-700 mb-1">Video Quality:</label>
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
                          <label className="block text-sm font-medium text-gray-700 mb-1">Instruments:</label>
                          <input
                            type="text"
                            value={editedMetadata.instruments}
                            onChange={(e) => setEditedMetadata({...editedMetadata, instruments: e.target.value})}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            placeholder="guitar, piano, drums (comma-separated)"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Guest Appearances:</label>
                          <input
                            type="text"
                            value={editedMetadata.guestAppearances}
                            onChange={(e) => setEditedMetadata({...editedMetadata, guestAppearances: e.target.value})}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            placeholder="artist names (comma-separated)"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Crowd Reaction:</label>
                          <input
                            type="text"
                            value={editedMetadata.crowdReaction}
                            onChange={(e) => setEditedMetadata({...editedMetadata, crowdReaction: e.target.value})}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            placeholder="wild, singing along, silent..."
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Unique Elements:</label>
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
                          onClick={() => sendBackForReview(moment._id)}
                          className="bg-orange-600 text-white px-3 py-1 rounded text-sm hover:bg-orange-700"
                        >
                          📤 Apply Changes & Send Back
                        </button>
                        <button
                          onClick={() => setEditingMoment(null)}
                          className="bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => approveMoment(moment._id)}
                      className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 flex items-center gap-1"
                      disabled={editingMoment === moment._id}
                    >
                      ✅ Approve
                    </button>
                    
                    <button
                      onClick={() => setRejectingMoment(moment._id)}
                      className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 flex items-center gap-1"
                      disabled={editingMoment === moment._id}
                    >
                      ❌ Reject
                    </button>
                  </div>
                  
                  {rejectingMoment === moment._id && (
                    <div className="mt-3 p-3 bg-white border rounded">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Rejection Reason:
                      </label>
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Explain why this content is being rejected..."
                        className="w-full p-2 border border-gray-300 rounded text-sm"
                        rows="2"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleReject(moment._id)}
                          className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                        >
                          Confirm Rejection
                        </button>
                        <button
                          onClick={() => {
                            setRejectingMoment(null);
                            setRejectionReason('');
                          }}
                          className="bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

// Platform Settings Tab
const SettingsTab = memo(({ platformSettings, setPlatformSettings, token }) => {
  const { cacheStatus, showDetails, refreshing, refreshStatus, handleRefresh, toggleDetails, checkRefreshStatus } = useCacheStatus(API_BASE_URL);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [localSettings, setLocalSettings] = useState(platformSettings);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Update platformSettings when props change
  React.useEffect(() => {
    if (platformSettings) {
      setLocalSettings(platformSettings);
      setHasChanges(false);
    }
  }, [platformSettings]);
  
  if (!platformSettings) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        <span className="ml-3">Loading platform settings...</span>
      </div>
    );
  }

  // Handle local setting changes
  const handleSettingChange = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  // Save all changes to database
  const saveAllChanges = async () => {
    try {
      setSaving(true);
      setSuccessMessage('');
      
      const response = await fetch(`${API_BASE_URL}/admin/settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(localSettings)
      });
      
      if (response.ok) {
        const result = await response.json();
        setPlatformSettings(result.settings);
        setLocalSettings(result.settings);
        setHasChanges(false);
        setSuccessMessage('✅ All platform settings saved successfully');
        
        // Refresh the page after a short delay to show the success message
        setTimeout(() => {
          window.location.reload();
        }, REFRESH_DELAY_MS);
      } else {
        setSuccessMessage('❌ Failed to save settings');
      }
    } catch (error) {
      setSuccessMessage('❌ Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  // Reset changes to original values
  const resetChanges = () => {
    setLocalSettings(platformSettings);
    setHasChanges(false);
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Platform Settings</h3>
        <div className="flex items-center gap-3">
          {successMessage && (
            <div className="text-green-600 text-sm font-medium">
              {successMessage}
            </div>
          )}
          {hasChanges && (
            <div className="flex items-center gap-2">
              <button
                onClick={resetChanges}
                disabled={saving}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Reset
              </button>
              <button
                onClick={saveAllChanges}
                disabled={saving}
                className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  <>💾 Save Changes</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Settings Summary - Moved to top */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          📊 Settings Summary
        </h4>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className={`p-3 rounded-lg ${localSettings?.web3Enabled ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'}`}>
            <div className="text-2xl">{localSettings?.web3Enabled ? '🌐' : '🚫'}</div>
            <div className="text-sm font-medium">Web3</div>
            <div className="text-xs">{localSettings?.web3Enabled ? 'Enabled' : 'Disabled'}</div>
          </div>
          <div className={`p-3 rounded-lg ${localSettings?.uploadsEnabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
            <div className="text-2xl">{localSettings?.uploadsEnabled ? '📤' : '🚫'}</div>
            <div className="text-sm font-medium">Uploads</div>
            <div className="text-xs">{localSettings?.uploadsEnabled ? 'Enabled' : 'Disabled'}</div>
          </div>
          <div className={`p-3 rounded-lg ${!localSettings?.maintenanceMode ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            <div className="text-2xl">{!localSettings?.maintenanceMode ? '✅' : '🔧'}</div>
            <div className="text-sm font-medium">Status</div>
            <div className="text-xs">{!localSettings?.maintenanceMode ? 'Live' : 'Maintenance'}</div>
          </div>
          <div className={`p-3 rounded-lg ${!localSettings?.autoApprovalEnabled ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>
            <div className="text-lg font-semibold">{!localSettings?.autoApprovalEnabled ? 'Manual Review' : 'Auto Approval'}</div>
            <div className="text-sm font-medium">Moderation</div>
            <div className="text-xs">{!localSettings?.autoApprovalEnabled ? 'Manual' : 'Auto'}</div>
          </div>
        </div>
      </div>
      
      {/* Cache Status */}
      {cacheStatus && (
        <div className="bg-amber-50 rounded-lg p-6 border border-amber-200">
          <h4 className="text-lg font-semibold text-amber-900 mb-4 flex items-center gap-2">
            📊 Cache Status
          </h4>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">
                  {!cacheStatus.hasCache ? 'Building UMO Database...' : 'Cache Status'}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {!cacheStatus.hasCache 
                    ? 'First-time setup: Loading all UMO performance data'
                    : `Last updated: ${cacheStatus.lastUpdated ? new Date(cacheStatus.lastUpdated).toLocaleDateString() : 'Unknown'}`
                  }
                </p>
                {cacheStatus.needsRefresh && (
                  <p className="text-xs text-amber-700 mt-1 font-medium">
                    ⚠️ Cache refresh recommended - new data available
                  </p>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleDetails}
                  className="text-amber-700 hover:text-amber-900 text-sm font-medium"
                >
                  {showDetails ? 'Hide' : 'Details'}
                </button>
                {cacheStatus.hasCache && (
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="px-3 py-1.5 bg-amber-600 text-white rounded text-sm hover:bg-amber-700 disabled:opacity-50 transition-colors"
                  >
                    {refreshing ? 'Refreshing...' : 'Refresh Cache'}
                  </button>
                )}
              </div>
            </div>
            
            {showDetails && cacheStatus.stats && (
              <div className="mt-3 pt-3 border-t border-amber-200 text-sm text-gray-700">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="font-medium">Performances:</span> {cacheStatus.stats.totalPerformances || 0}
                  </div>
                  <div>
                    <span className="font-medium">Songs:</span> {cacheStatus.stats.totalSongs || 0}
                  </div>
                  <div>
                    <span className="font-medium">API Calls:</span> {cacheStatus.stats.apiCallsUsed || 0}
                  </div>
                  <div>
                    <span className="font-medium">Date Range:</span> {cacheStatus.stats.dateRange?.earliest || '?'} - {cacheStatus.stats.dateRange?.latest || '?'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Web3/NFT Settings */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 border border-purple-200">
        <h4 className="text-lg font-semibold text-purple-900 mb-4 flex items-center gap-2">
          🌐 Web3 & NFT Features
        </h4>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h5 className="font-medium text-gray-900">Enable Web3/NFT Layer</h5>
              <p className="text-sm text-gray-600 mt-1">
                Controls whether users can see NFT minting options, connect wallets, and create blockchain tokens.
                When disabled, all Web3 features are hidden from the interface.
              </p>
              {localSettings?.web3Enabled && (
                <div className="mt-2">
                  <p className="text-xs text-purple-700 font-medium">Active Features:</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {localSettings.web3Features?.map(feature => (
                      <span key={feature} className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <label className="flex items-center cursor-pointer ml-4">
              <input
                type="checkbox"
                checked={localSettings?.web3Enabled || false}
                onChange={(e) => handleSettingChange('web3Enabled', e.target.checked)}
                disabled={saving}
                className="w-5 h-5 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 focus:ring-2"
              />
              <span className={`ml-2 text-sm font-medium ${localSettings?.web3Enabled ? 'text-green-700' : 'text-gray-500'}`}>
                {localSettings?.web3Enabled ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          </div>
        </div>
      </div>
      
      {/* Platform Controls */}
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          🎛️ Platform Controls
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h5 className="font-medium text-gray-900">Enable Uploads</h5>
              <p className="text-sm text-gray-600">Allow users to upload new moments</p>
            </div>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings?.uploadsEnabled || false}
                onChange={(e) => handleSettingChange('uploadsEnabled', e.target.checked)}
                disabled={saving}
                className="w-5 h-5 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 focus:ring-2"
              />
              <span className={`ml-2 text-sm font-medium ${localSettings?.uploadsEnabled ? 'text-green-700' : 'text-gray-500'}`}>
                {localSettings?.uploadsEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <h5 className="font-medium text-gray-900">Maintenance Mode</h5>
              <p className="text-sm text-gray-600">Show maintenance message to users</p>
            </div>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings?.maintenanceMode || false}
                onChange={(e) => handleSettingChange('maintenanceMode', e.target.checked)}
                disabled={saving}
                className="w-5 h-5 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500 focus:ring-2"
              />
              <span className={`ml-2 text-sm font-medium ${localSettings?.maintenanceMode ? 'text-red-700' : 'text-gray-500'}`}>
                {localSettings?.maintenanceMode ? 'Active' : 'Inactive'}
              </span>
            </label>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <h5 className="font-medium text-gray-900">Auto-Approval</h5>
              <p className="text-sm text-gray-600">Skip moderation queue (bypass review)</p>
            </div>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings?.autoApprovalEnabled || false}
                onChange={(e) => handleSettingChange('autoApprovalEnabled', e.target.checked)}
                disabled={saving}
                className="w-5 h-5 text-orange-600 bg-gray-100 border-gray-300 rounded focus:ring-orange-500 focus:ring-2"
              />
              <span className={`ml-2 text-sm font-medium ${localSettings?.autoApprovalEnabled ? 'text-orange-700' : 'text-gray-500'}`}>
                {localSettings?.autoApprovalEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          </div>
        </div>
      </div>
      
      {/* Platform Information */}
      <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
        <h4 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
          📋 Platform Information
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Platform Name</label>
            <div className="text-gray-900">{localSettings?.platformName}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Admin Email</label>
            <div className="text-gray-900">{localSettings?.adminEmail}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Upload Size</label>
            <div className="text-gray-900">{localSettings?.maxFileSize ? Math.round(localSettings.maxFileSize / 1024 / 1024 / 1024) : 0} GB</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Updated</label>
            <div className="text-gray-900">{localSettings?.updatedAt ? new Date(localSettings.updatedAt).toLocaleString() : 'Never'}</div>
          </div>
        </div>
        
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Platform Description</label>
          <div className="text-gray-900 text-sm">{localSettings?.platformDescription}</div>
        </div>
      </div>
      
    </div>
  );
});

UsersTab.displayName = 'UsersTab';
ModerationTab.displayName = 'ModerationTab';
SettingsTab.displayName = 'SettingsTab';
AdminPanel.displayName = 'AdminPanel';

export default AdminPanel;