// src/components/UI/FavoriteButton.jsx
import React, { memo, useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { useAuth } from '../Auth/AuthProvider';
import { useFavorites } from '../../hooks/useFavorites';

const FavoriteButton = memo(({
  momentId,
  size = 'md',
  showLabel = false,
  className = '',
  onToggle
}) => {
  const { token, user } = useAuth();
  const { isFavorite, toggleFavorite, checkFavorite } = useFavorites(token);
  const [isLiked, setIsLiked] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check initial state
  useEffect(() => {
    if (momentId && token) {
      checkFavorite(momentId).then(setIsLiked);
    }
  }, [momentId, token, checkFavorite]);

  // Sync with hook state
  useEffect(() => {
    if (momentId) {
      setIsLiked(isFavorite(momentId));
    }
  }, [momentId, isFavorite]);

  const handleClick = async (e) => {
    e.stopPropagation();
    e.preventDefault();

    if (!user) {
      alert('Please log in to favorite moments');
      return;
    }

    if (loading) return;

    setLoading(true);
    setIsAnimating(true);

    const result = await toggleFavorite(momentId);

    if (result.success) {
      setIsLiked(result.isFavorited);
      if (onToggle) onToggle(result.isFavorited);
    }

    setLoading(false);
    setTimeout(() => setIsAnimating(false), 300);
  };

  const sizeClasses = {
    sm: 'p-1',
    md: 'p-2',
    lg: 'p-3'
  };

  const iconSizes = {
    sm: 14,
    md: 18,
    lg: 22
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`
        ${sizeClasses[size]}
        rounded-full
        transition-all duration-200
        ${isLiked
          ? 'bg-red-500/20 hover:bg-red-500/30 text-red-500'
          : 'bg-gray-800/50 hover:bg-gray-700/50 text-gray-400 hover:text-red-400'
        }
        ${isAnimating ? 'scale-125' : ''}
        ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      title={isLiked ? 'Remove from favorites' : 'Add to favorites'}
    >
      <div className="flex items-center gap-1.5">
        <Heart
          size={iconSizes[size]}
          fill={isLiked ? 'currentColor' : 'none'}
          className={`transition-transform ${isAnimating ? 'scale-110' : ''}`}
        />
        {showLabel && (
          <span className="text-sm">
            {isLiked ? 'Favorited' : 'Favorite'}
          </span>
        )}
      </div>
    </button>
  );
});

FavoriteButton.displayName = 'FavoriteButton';

export default FavoriteButton;
