// src/components/Performance/panels/CommunityPanel.jsx
import React, { useState, memo } from 'react';
import { PenLine, Users, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';
import GuestbookSection from './GuestbookSection';
import LiveChatSection from './LiveChatSection';
import RSVPSection from './RSVPSection';

// Check if a show is upcoming (future date) - handles DD-MM-YYYY format from setlist.fm
const isUpcomingShow = (eventDate) => {
  if (!eventDate) return false;

  // Parse date - handle both DD-MM-YYYY and YYYY-MM-DD formats
  const parts = eventDate.split('-');
  if (parts.length !== 3) return false;

  let day, month, year;
  if (parts[0].length === 4) {
    // YYYY-MM-DD format
    [year, month, day] = parts.map(Number);
  } else {
    // DD-MM-YYYY format (setlist.fm)
    [day, month, year] = parts.map(Number);
  }

  const showDate = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  showDate.setHours(0, 0, 0, 0);

  return showDate >= today;
};

const CommunityPanel = memo(({ performance, user, token, onViewUserProfile }) => {
  const performanceId = performance?.id;
  const isUpcoming = isUpcomingShow(performance?.eventDate);

  const [activeTab, setActiveTab] = useState(isUpcoming ? 'chat' : 'guestbook');
  const [isExpanded, setIsExpanded] = useState(isUpcoming); // Expanded for upcoming shows

  // Tabs - guestbook and chat available for all shows, RSVP only for upcoming
  const tabs = [
    {
      id: 'guestbook',
      label: 'Guestbook',
      icon: PenLine,
      description: 'Sign the guestbook - share your memories!',
      available: true
    },
    {
      id: 'chat',
      label: 'Chat',
      icon: MessageCircle,
      description: 'Chat about the show',
      available: true
    },
    {
      id: 'rsvp',
      label: "I'm Going!",
      icon: Users,
      description: 'Let others know you\'ll be there',
      available: isUpcoming
    }
  ];

  const availableTabs = tabs.filter(t => t.available);

  if (!performanceId) return null;

  return (
    <div className="community-panel bg-gray-900/50 rounded-sm border border-gray-800/50 overflow-hidden">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <PenLine size={18} className="text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Community</h3>
        </div>
        {isExpanded ? (
          <ChevronUp size={18} className="text-gray-400" />
        ) : (
          <ChevronDown size={18} className="text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <>
          {/* Tab Header */}
          <div className="flex border-t border-b border-gray-800/50 overflow-x-auto scrollbar-hide">
            {availableTabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-3 text-sm font-medium
                    transition-colors whitespace-nowrap
                    ${isActive
                      ? 'text-white bg-gray-800/50 border-b-2 border-blue-500'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/30'
                    }
                  `}
                  style={{ minHeight: '44px' }}
                  title={tab.description}
                >
                  <Icon size={18} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Description */}
          <div className="px-4 py-2 bg-gray-800/20 border-b border-gray-800/30">
            <p className="text-xs text-gray-500">
              {tabs.find(t => t.id === activeTab)?.description}
            </p>
          </div>

          {/* Tab Content */}
          <div className="p-4">
            {activeTab === 'guestbook' && (
              <GuestbookSection
                performanceId={performanceId}
                user={user}
                token={token}
                onViewUserProfile={onViewUserProfile}
              />
            )}
            {activeTab === 'chat' && (
              <LiveChatSection
                performanceId={performanceId}
                user={user}
                token={token}
                onViewUserProfile={onViewUserProfile}
              />
            )}
            {activeTab === 'rsvp' && isUpcoming && (
              <RSVPSection
                performanceId={performanceId}
                user={user}
                token={token}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
});

CommunityPanel.displayName = 'CommunityPanel';

export default CommunityPanel;
