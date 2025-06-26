// src/components/UI/CreditsFooter.jsx
import React, { memo } from 'react';

const CreditsFooter = memo(() => (
  <footer className="mt-16 border-t border-gray-200 pt-8 pb-6">
    <div className="max-w-7xl mx-auto px-4">
      <div className="text-center text-gray-500 text-sm">
        <p className="mb-2">
          <strong>Credits</strong> - G.S 2025
        </p>
        <p>
          <a 
            href="mailto:sololoops@gmail.com?subject=UMO Repository Feedback"
            className="text-blue-600 hover:text-blue-800 underline transition-colors"
          >
            Submit feedback here
          </a>
        </p>
      </div>
    </div>
  </footer>
));

CreditsFooter.displayName = 'CreditsFooter';

export default CreditsFooter;