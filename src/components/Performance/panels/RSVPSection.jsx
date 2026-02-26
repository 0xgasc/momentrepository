// src/components/Performance/panels/RSVPSection.jsx
import React, { useState, useEffect, memo } from 'react';
import { Users, UserPlus, UserMinus, Check, Clock, Trash2 } from 'lucide-react';
import { useRSVP } from '../../../hooks/useCommunity';

const formatTimeAgo = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

const RSVPSection = memo(({ performanceId, user, token }) => {
  // eslint-disable-next-line no-unused-vars
  const { rsvps, count, loading, hasRsvpd, fetchRSVPs, addRSVP, removeRSVP } = useRSVP(performanceId, token);
  const [showForm, setShowForm] = useState(false);
  const [anonName, setAnonName] = useState('');
  const [message, setMessage] = useState('');

  // Anonymous ID for non-logged-in users
  const [anonId] = useState(() => {
    const stored = localStorage.getItem('umo-anon-id');
    if (stored) return stored;
    const newId = `anon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('umo-anon-id', newId);
    return newId;
  });

  useEffect(() => {
    fetchRSVPs();
  }, [fetchRSVPs]);

  // Check if current user/anon has RSVPd
  const currentRsvp = rsvps.find(r =>
    user ? r.user?._id === user.userId : r.anonymousId === anonId
  );

  const handleRSVP = async () => {
    if (!user && !anonName && !showForm) {
      setShowForm(true);
      return;
    }

    const result = await addRSVP(
      user ? null : (anonName || 'Anonymous'),
      message,
      user ? null : anonId
    );

    if (result.success) {
      setShowForm(false);
      setAnonName('');
      setMessage('');
    } else {
      alert(result.error);
    }
  };

  const handleRemoveRSVP = async () => {
    const result = await removeRSVP(user ? null : anonId);
    if (!result.success) {
      alert(result.error);
    }
  };

  const handleDelete = async (rsvpId) => {
    if (window.confirm('Are you sure you want to delete this RSVP? This action cannot be undone.')) {
      const result = await removeRSVP(null, rsvpId);
      if (!result.success) {
        alert(result.error || 'Failed to delete RSVP');
      }
    }
  };

  const isAdminOrMod = user && (user.role === 'admin' || user.role === 'mod');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="rsvp-section">
      {/* Counter */}
      <div className="flex items-center justify-between mb-4 p-4 bg-gradient-to-r from-green-900/30 to-emerald-900/30 rounded-sm border border-green-800/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/20 rounded-sm">
            <Users size={24} className="text-green-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{count}</div>
            <div className="text-sm text-green-400">
              {count === 1 ? 'person' : 'people'} going
            </div>
          </div>
        </div>

        {currentRsvp ? (
          <button
            onClick={handleRemoveRSVP}
            className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-sm transition-colors border border-red-600/50"
          >
            <UserMinus size={16} />
            Cancel RSVP
          </button>
        ) : (
          <button
            onClick={handleRSVP}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-sm transition-colors"
          >
            <UserPlus size={16} />
            I'm Going!
          </button>
        )}
      </div>

      {/* Anonymous form */}
      {showForm && !user && !currentRsvp && (
        <div className="mb-4 p-4 bg-gray-800/50 rounded-sm border border-gray-700">
          <div className="mb-3">
            <label className="block text-sm text-gray-400 mb-1">Display name</label>
            <input
              type="text"
              value={anonName}
              onChange={(e) => setAnonName(e.target.value)}
              placeholder="Your name..."
              className="w-full bg-gray-900/50 border border-gray-700 rounded-sm px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
              maxLength={50}
            />
          </div>
          <div className="mb-3">
            <label className="block text-sm text-gray-400 mb-1">Message (optional)</label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Can't wait for this show!"
              className="w-full bg-gray-900/50 border border-gray-700 rounded-sm px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
              maxLength={200}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRSVP}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-sm transition-colors"
            >
              Confirm RSVP
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* RSVP list */}
      <div className="space-y-2">
        {rsvps.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <Users size={24} className="mx-auto mb-2 opacity-50" />
            <p>Be the first to RSVP!</p>
          </div>
        ) : (
          rsvps.map((rsvp, idx) => (
            <div
              key={rsvp.id || idx}
              className="flex items-start gap-3 p-3 bg-gray-800/30 rounded-sm"
            >
              <div className="p-1.5 bg-green-500/20 rounded-full">
                <Check size={14} className="text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white truncate">
                    {rsvp.displayName}
                  </span>
                  {rsvp.isAnonymous && (
                    <span className="text-xs text-gray-500">(guest)</span>
                  )}
                </div>
                {rsvp.message && (
                  <p className="text-sm text-gray-400 mt-0.5">{rsvp.message}</p>
                )}
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock size={10} />
                    {formatTimeAgo(rsvp.createdAt)}
                  </div>
                  {isAdminOrMod && (
                    <button
                      onClick={() => handleDelete(rsvp._id)}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={10} />
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
});

RSVPSection.displayName = 'RSVPSection';

export default RSVPSection;
