// src/components/Performance/panels/CommunityPanel.jsx
import React, { useState, memo } from 'react';
import { MessageSquare, Users, Calendar, MessageCircle } from 'lucide-react';
import CommentsSection from './CommentsSection';
import LiveChatSection from './LiveChatSection';
import RSVPSection from './RSVPSection';
import MeetupSection from './MeetupSection';

const tabs = [
  { id: 'chat', label: 'Chat', icon: MessageCircle },
  { id: 'comments', label: 'Comments', icon: MessageSquare },
  { id: 'rsvp', label: "I'm Going!", icon: Users },
  { id: 'meetups', label: 'Meetups', icon: Calendar }
];

const CommunityPanel = memo(({ performance, user, token }) => {
  const [activeTab, setActiveTab] = useState('chat');

  const performanceId = performance?.id;

  if (!performanceId) return null;

  return (
    <div className="community-panel bg-gray-900/50 rounded-xl border border-gray-800/50 overflow-hidden">
      {/* Tab Header */}
      <div className="flex border-b border-gray-800/50 overflow-x-auto scrollbar-hide">
        {tabs.map(tab => {
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
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
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
        {activeTab === 'rsvp' && (
          <RSVPSection
            performanceId={performanceId}
            user={user}
            token={token}
          />
        )}
        {activeTab === 'meetups' && (
          <MeetupSection
            performanceId={performanceId}
            user={user}
            token={token}
          />
        )}
      </div>
    </div>
  );
});

CommunityPanel.displayName = 'CommunityPanel';

export default CommunityPanel;
