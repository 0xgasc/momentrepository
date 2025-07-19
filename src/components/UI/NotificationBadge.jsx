// UI/NotificationBadge.jsx - Notification badge for buttons
import React, { memo } from 'react';

const NotificationBadge = memo(({ show, color = 'red', className = '' }) => {
  if (!show) return null;

  const colorClasses = {
    red: 'bg-red-500',
    blue: 'bg-blue-500'
  };

  return (
    <div 
      className={`absolute -top-1 -right-1 w-3 h-3 ${colorClasses[color]} rounded-full border border-white ${className}`}
      style={{ 
        minWidth: '12px', 
        minHeight: '12px',
        zIndex: 10
      }}
    />
  );
});

NotificationBadge.displayName = 'NotificationBadge';

export default NotificationBadge;