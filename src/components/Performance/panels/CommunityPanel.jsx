// src/components/Performance/panels/CommunityPanel.jsx
import React, { useState, useEffect, memo } from 'react';
import { PenLine, Users, Calendar, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';
import GuestbookSection from './GuestbookSection';
import LiveChatSection from './LiveChatSection';
import RSVPSection from './RSVPSection';
import MeetupSection from './MeetupSection';

// Check if a show is upcoming (future date)
const isUpcomingShow = (eventDate) => {
  if (!eventDate) return false;
  const showDate = new Date(eventDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return showDate >= today;
};

const CommunityPanel = memo(({ performance, user, token }) => {
  const performanceId = performance?.id;
  const isUpcoming = isUpcomingShow(performance?.eventDate);

  const [activeTab, setActiveTab] = useState(isUpcoming ? 'chat' : 'guestbook');
  const [isExpanded, setIsExpanded] = useState(isUpcoming); // Expanded for upcoming shows

  // Filter tabs based on whether show is upcoming or past
  const tabs = [
    {
      id: 'guestbook',
      label: 'Guestbook',
      icon: PenLine,
      description: 'Sign the guestbook - leave your mark!',
      available: true
    },
    {
      id: 'chat',
      label: 'Live Chat',
      icon: MessageCircle,
      description: 'Real-time chat for the show',
      available: isUpcoming
    },
    {
      id: 'rsvp',
      label: "I'm Going!",
      icon: Users,
      description: 'Let others know you\'ll be there',
      available: isUpcoming
    },
    {
      id: 'meetups',
      label: 'Meetups',
      icon: Calendar,
      description: 'Coordinate pre-show hangouts',
      available: isUpcoming
    }
  ];

  const availableTabs = tabs.filter(t => t.available);

  // Reset to guestbook if current tab becomes unavailable
  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.find(t => t.id === activeTab)) {
      setActiveTab('guestbook');
    }
  }, [availableTabs, activeTab]);

  if (!performanceId) return null;

  return (
    <div className="community-panel bg-gray-900/50 rounded-lg border border-gray-800/50 overflow-hidden">
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
                    flex items-center gap-2 px-4 py-3 text-sm font-medium
                    transition-colors whitespace-nowrap
                    ${isActive
                      ? 'text-white bg-gray-800/50 border-b-2 border-blue-500'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/30'
                    }
                  `}
                  title={tab.description}
                >
                  <Icon size={16} />
                  {tab.label}
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
              />
            )}
            {activeTab === 'chat' && isUpcoming && (
              <LiveChatSection
                performanceId={performanceId}
                user={user}
                token={token}
              />
            )}
            {activeTab === 'rsvp' && isUpcoming && (
              <RSVPSection
                performanceId={performanceId}
                user={user}
                token={token}
              />
            )}
            {activeTab === 'meetups' && isUpcoming && (
              <MeetupSection
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
