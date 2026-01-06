// src/components/Performance/panels/CommunityPanel.jsx
import React, { useState, memo } from 'react';
import { MessageSquare, Users, Calendar, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';
import CommentsSection from './CommentsSection';
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
  const [activeTab, setActiveTab] = useState('chat');
  const [isExpanded, setIsExpanded] = useState(false); // Collapsed by default

  const performanceId = performance?.id;
  const isUpcoming = isUpcomingShow(performance?.eventDate);

  if (!performanceId) return null;

  // Filter tabs based on whether show is upcoming or past
  const tabs = [
    {
      id: 'chat',
      label: 'Live Chat',
      icon: MessageCircle,
      description: 'Real-time chat (like Discord)',
      available: true
    },
    {
      id: 'comments',
      label: 'Discussion',
      icon: MessageSquare,
      description: 'Threaded comments (like Reddit)',
      available: true
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

  // Reset to chat if current tab becomes unavailable
  if (!availableTabs.find(t => t.id === activeTab)) {
    setActiveTab('chat');
  }

  return (
    <div className="community-panel bg-gray-900/50 rounded-lg border border-gray-800/50 overflow-hidden">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <MessageCircle size={18} className="text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Community</h3>
          <span className="text-sm text-gray-500">Chat & Discussion</span>
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
            {activeTab === 'chat' && (
              <LiveChatSection
                performanceId={performanceId}
                user={user}
                token={token}
              />
            )}
            {activeTab === 'comments' && (
              <CommentsSection
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
