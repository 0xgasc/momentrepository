// src/components/UI/CreditsFooter.jsx
import React, { memo } from 'react';

const CreditsFooter = memo(({ onContactClick }) => (
  <footer className="mt-16 border-t border-gray-700/50 pt-8 pb-6">
    <div className="max-w-7xl mx-auto px-4">
      <div className="text-center text-gray-500 text-sm">
        <p className="mb-2">
          <strong>Credits</strong> - G.S 2025
        </p>
        <p>
          <button
            onClick={onContactClick}
            className="text-blue-400 hover:text-blue-300 underline transition-colors"
          >
            Contact Form
          </button>
        </p>
      </div>
    </div>
  </footer>
));

CreditsFooter.displayName = 'CreditsFooter';

export default CreditsFooter;