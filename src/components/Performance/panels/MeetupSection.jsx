// src/components/Performance/panels/MeetupSection.jsx
import React, { useState, useEffect, memo } from 'react';
import {
  Calendar, MapPin, Clock, Users, Plus, Car, Hotel, Utensils,
  ChevronDown, ChevronUp, MessageSquare, UserPlus, LogOut
} from 'lucide-react';
import { useMeetups } from '../../../hooks/useCommunity';

const meetupTypes = [
  { id: 'meetup', label: 'Meetup', icon: Users, color: 'blue' },
  { id: 'carpool', label: 'Carpool', icon: Car, color: 'green' },
  { id: 'hotel', label: 'Hotel Share', icon: Hotel, color: 'purple' },
  { id: 'food', label: 'Pre-show Meal', icon: Utensils, color: 'orange' }
];

const getTypeConfig = (type) => meetupTypes.find(t => t.id === type) || meetupTypes[0];

const formatDate = (date) => {
  if (!date) return null;
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

const MeetupCard = memo(({ meetup, user, onJoin, onLeave }) => {
  const [expanded, setExpanded] = useState(false);
  const typeConfig = getTypeConfig(meetup.type);
  const Icon = typeConfig.icon;

  const isJoined = user && meetup.participants?.some(
    p => p.user?._id === user.userId
  );
  const isOrganizer = user && meetup.user?._id === user.userId;

  const colorClasses = {
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    green: 'bg-green-500/20 text-green-400 border-green-500/50',
    purple: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
    orange: 'bg-orange-500/20 text-orange-400 border-orange-500/50'
  };

  return (
    <div className="meetup-card bg-gray-800/50 rounded-sm border border-gray-700/50 overflow-hidden">
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-800/30 transition-colors"
      >
        <div className={`p-2 rounded-sm border ${colorClasses[typeConfig.color]}`}>
          <Icon size={20} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded ${colorClasses[typeConfig.color]}`}>
              {typeConfig.label}
            </span>
            {isOrganizer && (
              <span className="text-xs text-yellow-400">Organizer</span>
            )}
          </div>

          <h4 className="font-medium text-white truncate">{meetup.title}</h4>

          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-400">
            {meetup.time && (
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {formatDate(meetup.time)}
              </span>
            )}
            {meetup.location && (
              <span className="flex items-center gap-1">
                <MapPin size={12} />
                {meetup.location}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users size={12} />
              {meetup.participantCount || 0}
              {meetup.maxParticipants && ` / ${meetup.maxParticipants}`}
            </span>
          </div>
        </div>

        <div className="text-gray-500">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-700/50">
          {/* Description */}
          {meetup.description && (
            <p className="text-sm text-gray-300 mt-3 whitespace-pre-wrap">
              {meetup.description}
            </p>
          )}

          {/* Organizer */}
          <div className="mt-3 text-xs text-gray-500">
            Organized by <span className="text-gray-300">{meetup.user?.displayName}</span>
          </div>

          {/* Participants */}
          {meetup.participants?.length > 0 && (
            <div className="mt-3">
              <div className="text-xs text-gray-400 mb-2">Participants:</div>
              <div className="flex flex-wrap gap-2">
                {meetup.participants.map((p, idx) => (
                  <span
                    key={p.user?._id || idx}
                    className="text-xs bg-gray-700/50 px-2 py-1 rounded text-gray-300"
                  >
                    {p.user?.displayName}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Replies */}
          {meetup.replies?.length > 0 && (
            <div className="mt-3">
              <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                <MessageSquare size={12} />
                {meetup.replies.length} replies
              </div>
              <div className="space-y-2">
                {meetup.replies.map((reply, idx) => (
                  <div key={idx} className="text-sm bg-gray-900/50 rounded-sm p-2">
                    <span className="text-gray-400 text-xs">{reply.user?.displayName}:</span>
                    <p className="text-gray-300">{reply.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 mt-4">
            {!isOrganizer && user && (
              isJoined ? (
                <button
                  onClick={() => onLeave(meetup._id)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-sm text-sm transition-colors"
                >
                  <LogOut size={14} />
                  Leave
                </button>
              ) : (
                <button
                  onClick={() => onJoin(meetup._id)}
                  disabled={meetup.spotsRemaining === 0}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-sm text-sm transition-colors"
                >
                  <UserPlus size={14} />
                  {meetup.spotsRemaining === 0 ? 'Full' : 'Join'}
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
});

MeetupCard.displayName = 'MeetupCard';

const CreateMeetupForm = memo(({ onSubmit, onCancel }) => {
  const [type, setType] = useState('meetup');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [time, setTime] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      type,
      title,
      description,
      location,
      time: time || null,
      maxParticipants: maxParticipants ? parseInt(maxParticipants) : null
    });
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-gray-800/50 rounded-sm border border-gray-700">
      <h4 className="font-medium text-white mb-4">Create a Meetup</h4>

      {/* Type selection */}
      <div className="mb-3">
        <label className="block text-sm text-gray-400 mb-2">Type</label>
        <div className="grid grid-cols-2 gap-2">
          {meetupTypes.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setType(t.id)}
                className={`
                  flex items-center gap-2 p-2 rounded-sm border text-sm transition-colors
                  ${type === t.id
                    ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                    : 'bg-gray-900/50 border-gray-700 text-gray-400 hover:text-white'
                  }
                `}
              >
                <Icon size={16} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Title */}
      <div className="mb-3">
        <label className="block text-sm text-gray-400 mb-1">Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Pre-show drinks at..."
          className="w-full bg-gray-900/50 border border-gray-700 rounded-sm px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
          maxLength={100}
        />
      </div>

      {/* Description */}
      <div className="mb-3">
        <label className="block text-sm text-gray-400 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="More details..."
          className="w-full bg-gray-900/50 border border-gray-700 rounded-sm px-3 py-2 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={2}
          maxLength={1000}
        />
      </div>

      {/* Location */}
      <div className="mb-3">
        <label className="block text-sm text-gray-400 mb-1">Location</label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Bar name, address..."
          className="w-full bg-gray-900/50 border border-gray-700 rounded-sm px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          maxLength={200}
        />
      </div>

      {/* Time */}
      <div className="mb-3">
        <label className="block text-sm text-gray-400 mb-1">Time</label>
        <input
          type="datetime-local"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="w-full bg-gray-900/50 border border-gray-700 rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Max participants */}
      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-1">Max participants (optional)</label>
        <input
          type="number"
          value={maxParticipants}
          onChange={(e) => setMaxParticipants(e.target.value)}
          placeholder="Leave empty for unlimited"
          min="2"
          max="100"
          className="w-full bg-gray-900/50 border border-gray-700 rounded-sm px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!title.trim()}
          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-sm transition-colors"
        >
          Create Meetup
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
});

CreateMeetupForm.displayName = 'CreateMeetupForm';

const MeetupSection = memo(({ performanceId, user, token }) => {
  const { meetups, loading, fetchMeetups, createMeetup, joinMeetup, leaveMeetup } = useMeetups(performanceId, token);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchMeetups(null); // Fetch all meetups
  }, [fetchMeetups]);

  const handleCreate = async (data) => {
    const result = await createMeetup(data);
    if (result.success) {
      setShowForm(false);
    } else {
      alert(result.error);
    }
  };

  const handleJoin = async (meetupId) => {
    const result = await joinMeetup(meetupId);
    if (!result.success) {
      alert(result.error);
    }
  };

  const handleLeave = async (meetupId) => {
    const result = await leaveMeetup(meetupId);
    if (!result.success) {
      alert(result.error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="meetup-section">
      {/* Header - just the create button */}
      {user && !showForm && (
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-sm transition-colors"
          >
            <Plus size={16} />
            Create Meetup
          </button>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="mb-4">
          <CreateMeetupForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {/* Login prompt */}
      {!user && (
        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-sm text-sm text-yellow-400">
          Log in to create or join meetups
        </div>
      )}

      {/* Meetups list */}
      <div className="space-y-3">
        {meetups.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Calendar size={24} className="mx-auto mb-2 opacity-50" />
            <p>No meetups yet. {user ? 'Create one!' : 'Log in to create one!'}</p>
          </div>
        ) : (
          meetups.map(meetup => (
            <MeetupCard
              key={meetup._id}
              meetup={meetup}
              user={user}
              onJoin={handleJoin}
              onLeave={handleLeave}
            />
          ))
        )}
      </div>
    </div>
  );
});

MeetupSection.displayName = 'MeetupSection';

export default MeetupSection;
