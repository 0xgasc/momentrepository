// src/components/Community/TopContributors.jsx
import React, { useState, useEffect, memo } from 'react';
import { Trophy, ChevronDown, ChevronUp, Eye, Film, Award } from 'lucide-react';
import { API_BASE_URL } from '../Auth/AuthProvider';

const TopContributors = memo(({ onViewUserProfile }) => {
  const [contributors, setContributors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const fetchContributors = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/community/top-contributors?limit=10`);
        if (response.ok) {
          const data = await response.json();
          setContributors(data.contributors || []);
        }
      } catch (err) {
        console.error('Failed to fetch top contributors:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchContributors();
  }, []);

  if (loading) {
    return (
      <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-4">
        <div className="flex items-center gap-2 text-gray-400">
          <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading contributors...</span>
        </div>
      </div>
    );
  }

  if (contributors.length === 0) {
    return null;
  }

  const displayContributors = isExpanded ? contributors : contributors.slice(0, 5);

  return (
    <div className="bg-gray-900/50 rounded-lg border border-gray-800 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Trophy size={18} className="text-yellow-400" />
          <h3 className="font-semibold text-white">Top Contributors</h3>
        </div>
        {isExpanded ? (
          <ChevronUp size={18} className="text-gray-400" />
        ) : (
          <ChevronDown size={18} className="text-gray-400" />
        )}
      </button>

      {/* Contributors List */}
      <div className="px-4 pb-4">
        <div className="space-y-2">
          {displayContributors.map((contributor, idx) => (
            <ContributorRow
              key={contributor._id}
              contributor={contributor}
              rank={idx + 1}
              onViewUserProfile={onViewUserProfile}
            />
          ))}
        </div>

        {/* Show More/Less */}
        {contributors.length > 5 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full mt-3 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            {isExpanded ? 'Show Less' : `Show All ${contributors.length}`}
          </button>
        )}
      </div>
    </div>
  );
});

const ContributorRow = memo(({ contributor, rank, onViewUserProfile }) => {
  const rankColors = {
    1: 'text-yellow-400',
    2: 'text-gray-300',
    3: 'text-orange-400'
  };

  const rankColor = rankColors[rank] || 'text-gray-500';

  return (
    <div className="flex items-center gap-3 py-2 px-2 rounded hover:bg-gray-800/30 transition-colors">
      {/* Rank */}
      <span className={`w-6 text-center font-bold ${rankColor}`}>
        {rank}
      </span>

      {/* User Info */}
      <div className="flex-1 min-w-0">
        <button
          onClick={() => onViewUserProfile && onViewUserProfile(contributor._id)}
          className="font-medium text-white hover:text-blue-400 transition-colors truncate block"
        >
          {contributor.displayName}
        </button>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Film size={10} />
            {contributor.uploadCount}
          </span>
          <span className="flex items-center gap-1">
            <Eye size={10} />
            {formatNumber(contributor.totalViews)}
          </span>
          {contributor.firstCaptures > 0 && (
            <span className="flex items-center gap-1">
              <Award size={10} className="text-yellow-400" />
              {contributor.firstCaptures}
            </span>
          )}
        </div>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-1">
        {contributor.badges.slice(0, 3).map(badge => (
          <span
            key={badge.id}
            title={badge.label}
            className="text-sm"
          >
            {badge.icon}
          </span>
        ))}
      </div>
    </div>
  );
});

ContributorRow.displayName = 'ContributorRow';

// Helper function
const formatNumber = (num) => {
  if (!num) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

TopContributors.displayName = 'TopContributors';

export default TopContributors;
