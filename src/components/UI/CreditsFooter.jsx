// src/components/UI/CreditsFooter.jsx
import React, { memo } from 'react';
import { Globe, MessageCircle, ExternalLink, Archive } from 'lucide-react';

const SocialLink = memo(({ icon: Icon, label, href }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="flex flex-col items-center gap-2 p-3 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700/30 transition-colors group"
    style={{ borderRadius: '2px' }}
  >
    <Icon size={20} className="text-gray-400 group-hover:text-blue-400 transition-colors" />
    <span className="text-xs text-gray-500 group-hover:text-gray-300 text-center transition-colors">
      {label}
    </span>
  </a>
));
SocialLink.displayName = 'SocialLink';

const CreditsFooter = memo(({ onContactClick }) => (
  <footer className="mt-16 border-t border-gray-700/50 pt-8 pb-6">
    <div className="max-w-7xl mx-auto px-4">
      {/* Social Links Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <SocialLink icon={Globe} label="Official Website" href="https://www.unknownmortalorchestra.com/" />
        <SocialLink icon={MessageCircle} label="Discord" href="https://discord.gg/9MzfYFeW2p" />
        <SocialLink icon={ExternalLink} label="Reddit" href="https://www.reddit.com/r/UMOband/" />
        <SocialLink icon={ExternalLink} label="Instagram" href="https://www.instagram.com/unknownmortalorchestra/" />
        <SocialLink icon={Archive} label="Archive.org" href="#" />
      </div>

      {/* Contact Button */}
      <div className="text-center text-gray-500 text-sm border-t border-gray-800 pt-4">
        <button
          onClick={onContactClick}
          className="text-blue-400 hover:text-blue-300 underline transition-colors"
        >
          Contact Form
        </button>
      </div>
    </div>
  </footer>
));

CreditsFooter.displayName = 'CreditsFooter';

export default CreditsFooter;