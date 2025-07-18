// Pull-to-refresh component for mobile web apps
import React, { useState, useRef, memo } from 'react';

const PullToRefresh = memo(({ 
  onRefresh, 
  children, 
  threshold = 80, 
  maxPullDistance = 120,
  refreshingText = "Refreshing...",
  pullText = "Pull down to refresh",
  releaseText = "Release to refresh"
}) => {
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [startY, setStartY] = useState(0);
  const containerRef = useRef(null);

  // Check if we're at the top of the page
  const isAtTop = () => {
    return window.scrollY === 0 && document.documentElement.scrollTop === 0;
  };

  // Handle touch start
  const handleTouchStart = (e) => {
    if (!isAtTop() || isRefreshing) return;
    
    const touch = e.touches[0];
    setStartY(touch.clientY);
  };

  // Handle touch move
  const handleTouchMove = (e) => {
    if (!isAtTop() || isRefreshing || !startY) return;
    
    const touch = e.touches[0];
    const currentY = touch.clientY;
    const deltaY = currentY - startY;
    
    if (deltaY > 0) {
      // Prevent default scroll behavior when pulling down
      e.preventDefault();
      
      // Calculate pull distance with diminishing returns
      const distance = Math.min(
        Math.pow(deltaY, 0.7) * 0.6, 
        maxPullDistance
      );
      
      setPullDistance(distance);
      setIsPulling(true);
    }
  };

  // Handle touch end
  const handleTouchEnd = () => {
    if (!isPulling || isRefreshing) return;
    
    if (pullDistance >= threshold) {
      // Trigger refresh
      setIsRefreshing(true);
      onRefresh().finally(() => {
        setIsRefreshing(false);
        setIsPulling(false);
        setPullDistance(0);
        setStartY(0);
      });
    } else {
      // Reset state
      setIsPulling(false);
      setPullDistance(0);
      setStartY(0);
    }
  };

  // Get current status text
  const getStatusText = () => {
    if (isRefreshing) return refreshingText;
    if (pullDistance >= threshold) return releaseText;
    return pullText;
  };

  // Get icon rotation for pull indicator
  const getIconRotation = () => {
    if (isRefreshing) return 0;
    return Math.min((pullDistance / threshold) * 180, 180);
  };

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: `translateY(${isPulling || isRefreshing ? pullDistance * 0.5 : 0}px)`,
        transition: isPulling ? 'none' : 'transform 0.3s ease-out'
      }}
    >
      {/* Pull-to-refresh indicator */}
      {(isPulling || isRefreshing) && (
        <div
          className="pull-to-refresh-indicator"
          style={{
            position: 'fixed',
            top: '0',
            left: '50%',
            transform: `translateX(-50%) translateY(${Math.max(pullDistance - 40, 0)}px)`,
            zIndex: 1000,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: '20px',
            padding: '12px 20px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            color: '#374151',
            transition: 'transform 0.1s ease-out',
            border: '1px solid rgba(0, 0, 0, 0.1)'
          }}
        >
          <div
            style={{
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: `rotate(${getIconRotation()}deg)`,
              transition: isRefreshing ? 'none' : 'transform 0.2s ease-out'
            }}
          >
            {isRefreshing ? (
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid #e5e7eb',
                  borderTop: '2px solid #3b82f6',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}
              />
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 5v14l-4-4m4 4l4-4" />
              </svg>
            )}
          </div>
          <span>{getStatusText()}</span>
        </div>
      )}

      {/* Content */}
      <div style={{ minHeight: '100vh' }}>
        {children}
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
});

PullToRefresh.displayName = 'PullToRefresh';

export default PullToRefresh;