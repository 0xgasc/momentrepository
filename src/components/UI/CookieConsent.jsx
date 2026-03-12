// src/components/UI/CookieConsent.jsx
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const STORAGE_KEY = 'umo-cookie-consent';

const CookieConsent = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(STORAGE_KEY);
    if (!consent) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(STORAGE_KEY, 'declined');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4 pointer-events-none">
      <div
        className="max-w-2xl mx-auto bg-gray-900/95 backdrop-blur border border-gray-700/60 rounded-lg shadow-2xl pointer-events-auto"
        style={{ borderRadius: '4px' }}
      >
        <div className="flex items-start gap-3 p-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-300 leading-relaxed">
              This site uses cookies and third-party embeds (YouTube, Google Fonts) to function.
              By continuing you agree to our use of cookies.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-0.5">
            <button
              onClick={decline}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1"
            >
              Decline
            </button>
            <button
              onClick={accept}
              className="text-xs bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 px-3 py-1.5 rounded transition-colors font-medium"
              style={{ borderRadius: '2px' }}
            >
              Accept
            </button>
            <button
              onClick={decline}
              className="p-1 text-gray-600 hover:text-gray-400 transition-colors"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
