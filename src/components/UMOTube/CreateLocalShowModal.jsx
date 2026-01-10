// src/components/UMOTube/CreateLocalShowModal.jsx
// Modal for creating local performances (shows not on setlist.fm)
import React, { useState, memo } from 'react';
import { X, Calendar, MapPin, Music, Plus, Trash2, Loader2, Archive, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '../Auth/AuthProvider';

const CreateLocalShowModal = memo(({
  defaultDate = '',
  defaultVenue = '',
  archiveId = '',
  tracks = [],
  onCreated,
  onClose
}) => {
  // Form state
  const [eventDate, setEventDate] = useState(defaultDate);
  const [venueName, setVenueName] = useState(defaultVenue);
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('United States');
  const [notes, setNotes] = useState('');

  // Setlist state (populated from archive tracks if available)
  const [songs, setSongs] = useState(
    tracks.length > 0
      ? tracks.map((t, i) => ({ name: t.songName, position: i + 1 }))
      : []
  );

  // UI state
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);

  const handleAddSong = () => {
    setSongs([...songs, { name: '', position: songs.length + 1 }]);
  };

  const handleRemoveSong = (index) => {
    const newSongs = songs.filter((_, i) => i !== index);
    // Reorder positions
    setSongs(newSongs.map((s, i) => ({ ...s, position: i + 1 })));
  };

  const handleSongChange = (index, value) => {
    const newSongs = [...songs];
    newSongs[index] = { ...newSongs[index], name: value };
    setSongs(newSongs);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    if (!eventDate || !venueName || !city) {
      setError('Date, venue name, and city are required');
      return;
    }

    // Validate date format (should be YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
      setError('Date must be in YYYY-MM-DD format');
      return;
    }

    setIsCreating(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/local-performances`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          eventDate,
          venue: {
            name: venueName,
            city,
            state,
            country
          },
          sets: songs.length > 0 ? [{
            name: 'Main Set',
            songs: songs.filter(s => s.name.trim()).map((s, i) => ({
              name: s.name.trim(),
              position: i + 1
            }))
          }] : [],
          archiveOrgId: archiveId || undefined,
          archiveOrgUrl: archiveId ? `https://archive.org/details/${archiveId}` : undefined,
          notes: notes.trim() || undefined
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create local performance');
      }

      const data = await response.json();
      console.log('Created local performance:', data);
      onCreated(data);
    } catch (err) {
      console.error('Error creating local performance:', err);
      setError(err.message || 'Failed to create local performance');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
              <Plus size={16} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Create Local Show</h2>
              <p className="text-xs text-gray-500">For shows not on setlist.fm</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Archive.org info if available */}
          {archiveId && (
            <div className="flex items-center gap-2 p-3 bg-blue-900/30 border border-blue-700 rounded-lg text-blue-400 text-sm">
              <Archive size={16} />
              <span>Linked to archive.org: {archiveId}</span>
            </div>
          )}

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              <Calendar size={14} className="inline mr-1" />
              Event Date *
            </label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="umo-input w-full"
              required
            />
          </div>

          {/* Venue Name */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              <MapPin size={14} className="inline mr-1" />
              Venue Name *
            </label>
            <input
              type="text"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              placeholder="e.g., Larimer Lounge"
              className="umo-input w-full"
              required
            />
          </div>

          {/* City & State */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">City *</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g., Denver"
                className="umo-input w-full"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">State</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g., CO"
                className="umo-input w-full"
              />
            </div>
          </div>

          {/* Country */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Country</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="umo-input w-full"
            >
              <option value="United States">United States</option>
              <option value="Canada">Canada</option>
              <option value="United Kingdom">United Kingdom</option>
              <option value="Australia">Australia</option>
              <option value="New Zealand">New Zealand</option>
              <option value="Germany">Germany</option>
              <option value="France">France</option>
              <option value="Netherlands">Netherlands</option>
              <option value="Belgium">Belgium</option>
              <option value="Japan">Japan</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Setlist */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              <Music size={14} className="inline mr-1" />
              Setlist ({songs.length} songs)
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {songs.map((song, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-6">{index + 1}.</span>
                  <input
                    type="text"
                    value={song.name}
                    onChange={(e) => handleSongChange(index, e.target.value)}
                    placeholder="Song name"
                    className="umo-input flex-1 text-sm py-1.5"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveSong(index)}
                    className="p-1.5 text-red-400 hover:bg-red-900/30 rounded transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleAddSong}
              className="mt-2 flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              <Plus size={14} />
              Add song
            </button>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional information about this show..."
              rows={2}
              className="umo-input w-full"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isCreating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus size={16} />
                  Create Local Show
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

CreateLocalShowModal.displayName = 'CreateLocalShowModal';

export default CreateLocalShowModal;
