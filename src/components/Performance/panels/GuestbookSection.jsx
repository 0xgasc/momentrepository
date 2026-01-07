// src/components/Performance/panels/GuestbookSection.jsx
import React, { useState, useEffect, memo } from 'react';
import { PenLine, Clock, User, UserX } from 'lucide-react';
import { useGuestbook } from '../../../hooks/useCommunity';

const formatTimeAgo = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
};

const SignatureItem = memo(({ signature }) => {
  const isAnon = signature.isAnonymous || !signature.user;
  const displayName = isAnon
    ? (signature.displayName || 'Anonymous Fan')
    : (signature.user?.displayName || signature.displayName || 'Fan');

  return (
    <div className="signature-item py-3 border-b border-gray-800/30 last:border-b-0">
      <div className="flex items-start gap-3">
        {/* Avatar/Icon */}
        <div className={`
          w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
          ${isAnon ? 'bg-gray-700 text-gray-400' : 'bg-blue-600 text-white'}
        `}>
          {isAnon ? <UserX size={14} /> : displayName.charAt(0).toUpperCase()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`font-medium text-sm ${isAnon ? 'text-gray-400 italic' : 'text-white'}`}>
              {displayName}
            </span>
            <span className="text-gray-600">signed</span>
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Clock size={10} />
              {formatTimeAgo(signature.createdAt)}
            </span>
          </div>

          {signature.message && (
            <p className="text-gray-300 text-sm whitespace-pre-wrap break-words">
              "{signature.message}"
            </p>
          )}
        </div>
      </div>
    </div>
  );
});

SignatureItem.displayName = 'SignatureItem';

const GuestbookSection = memo(({ performanceId, user, token }) => {
  const { signatures, loading, fetchSignatures, addSignature } = useGuestbook(performanceId, token);
  const [message, setMessage] = useState('');
  const [anonName, setAnonName] = useState('');
  const [signAsAnon, setSignAsAnon] = useState(!user);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchSignatures();
  }, [fetchSignatures]);

  // Update anon preference when user logs in/out
  useEffect(() => {
    if (!user) setSignAsAnon(true);
  }, [user]);

  const handleSign = async () => {
    if (submitting) return;

    const displayName = signAsAnon ? (anonName.trim() || 'Anonymous Fan') : (user?.displayName || 'Fan');

    setSubmitting(true);
    const result = await addSignature(displayName, message.trim(), signAsAnon);
    setSubmitting(false);

    if (result.success) {
      setMessage('');
      setAnonName('');
    } else {
      alert(result.error || 'Failed to sign guestbook');
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
    <div className="guestbook-section">
      {/* Sign the Guestbook */}
      <div className="mb-6 p-4 bg-gray-800/30 rounded-lg border border-gray-700/50">
        <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
          <PenLine size={14} className="text-blue-400" />
          Sign the Guestbook
        </h4>

        {/* Anonymous name input (when not logged in or signing as anon) */}
        {(signAsAnon || !user) && (
          <input
            type="text"
            value={anonName}
            onChange={(e) => setAnonName(e.target.value)}
            placeholder="Your name (optional)"
            className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={50}
          />
        )}

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Leave a message (optional)..."
          className="w-full bg-gray-900/50 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={2}
          maxLength={280}
        />

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-3">
            {user && (
              <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={signAsAnon}
                  onChange={(e) => setSignAsAnon(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                />
                Sign anonymously
              </label>
            )}
            <span className="text-xs text-gray-500">
              {message.length}/280
            </span>
          </div>

          <button
            onClick={handleSign}
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border border-white border-t-transparent"></div>
                Signing...
              </>
            ) : (
              <>
                <PenLine size={14} />
                Sign
              </>
            )}
          </button>
        </div>
      </div>

      {/* Signatures List */}
      <div className="signatures-list">
        {signatures.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <PenLine size={24} className="mx-auto mb-2 opacity-50" />
            <p>No signatures yet. Be the first to sign!</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-3">
              {signatures.length} {signatures.length === 1 ? 'signature' : 'signatures'}
            </p>
            {signatures.map(sig => (
              <SignatureItem key={sig._id} signature={sig} />
            ))}
          </>
        )}
      </div>
    </div>
  );
});

GuestbookSection.displayName = 'GuestbookSection';

export default GuestbookSection;
