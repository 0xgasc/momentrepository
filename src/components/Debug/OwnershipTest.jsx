// src/components/Debug/OwnershipTest.jsx - TEMPORARY TEST COMPONENT
import React, { useState, useEffect } from 'react';
import { useAuth, API_BASE_URL } from '../Auth/AuthProvider';

const OwnershipTest = () => {
  const { user } = useAuth();
  const [moments, setMoments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTestMoments = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/moments?limit=5`);
        const data = await response.json();
        setMoments(data.moments || []);
      } catch (err) {
        console.error('Error loading test moments:', err);
      } finally {
        setLoading(false);
      }
    };

    loadTestMoments();
  }, []);

  const testOwnership = (moment) => {
    if (!user || !moment?.user) {
      return {
        isOwner: false,
        reason: 'No user or moment.user'
      };
    }

    const userLoggedInId = user.id || user._id;
    const momentUploaderId = moment.user._id || moment.user.id;
    
    const isOwner = userLoggedInId === momentUploaderId;
    
    return {
      isOwner,
      reason: isOwner ? 'IDs match' : 'IDs do not match',
      details: {
        userLoggedInId,
        momentUploaderId,
        userDisplayName: user.displayName,
        momentUploaderName: moment.user.displayName
      }
    };
  };

  if (!user) {
    return (
      <div style={{ 
        padding: '20px', 
        margin: '20px 0', 
        background: '#fee2e2', 
        border: '1px solid #fecaca',
        borderRadius: '8px'
      }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#dc2626' }}>
          🔐 Ownership Test - Not Logged In
        </h3>
        <p style={{ margin: '0', color: '#7f1d1d' }}>
          Please log in to test ownership detection
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ 
        padding: '20px', 
        margin: '20px 0', 
        background: '#dbeafe', 
        border: '1px solid #bfdbfe',
        borderRadius: '8px'
      }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#1d4ed8' }}>
          🔍 Loading Test Moments...
        </h3>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '20px', 
      margin: '20px 0', 
      background: '#f0fdf4', 
      border: '1px solid #bbf7d0',
      borderRadius: '8px'
    }}>
      <h3 style={{ margin: '0 0 15px 0', color: '#166534' }}>
        🔍 Ownership Test Results
      </h3>
      
      <div style={{ 
        marginBottom: '15px',
        padding: '10px',
        background: '#e0f2fe',
        borderRadius: '6px'
      }}>
        <strong>Current User:</strong><br/>
        ID: {user.id || 'No ID'}<br/>
        _ID: {user._id || 'No _ID'}<br/>
        Name: {user.displayName || 'No display name'}<br/>
        Email: {user.email || 'No email'}
      </div>

      <div style={{ display: 'grid', gap: '15px' }}>
        {moments.slice(0, 3).map((moment) => {
          const ownershipTest = testOwnership(moment);
          
          return (
            <div
              key={moment._id}
              style={{
                padding: '15px',
                background: ownershipTest.isOwner ? '#dcfce7' : '#fef3c7',
                border: `2px solid ${ownershipTest.isOwner ? '#16a34a' : '#d97706'}`,
                borderRadius: '8px'
              }}
            >
              <div style={{ marginBottom: '10px' }}>
                <strong style={{ color: ownershipTest.isOwner ? '#166534' : '#92400e' }}>
                  {ownershipTest.isOwner ? '✅ YOU OWN THIS' : '❌ NOT YOURS'}
                </strong>
              </div>
              
              <div style={{ fontSize: '14px', marginBottom: '10px' }}>
                <strong>Moment:</strong> "{moment.songName}" at {moment.venueName}<br/>
                <strong>Uploaded by:</strong> {moment.user?.displayName || 'Unknown'}
              </div>
              
              <div style={{ 
                fontSize: '12px', 
                fontFamily: 'monospace',
                background: 'rgba(0,0,0,0.1)',
                padding: '8px',
                borderRadius: '4px'
              }}>
                <strong>Debug Info:</strong><br/>
                Reason: {ownershipTest.reason}<br/>
                Your ID: {ownershipTest.details.userLoggedInId}<br/>
                Moment User ID: {ownershipTest.details.momentUploaderId}<br/>
                IDs Match: {ownershipTest.details.userLoggedInId === ownershipTest.details.momentUploaderId ? 'YES' : 'NO'}
              </div>
            </div>
          );
        })}
      </div>
      
      <div style={{
        marginTop: '15px',
        padding: '10px',
        background: '#f1f5f9',
        borderRadius: '6px',
        fontSize: '12px'
      }}>
        <strong>How to test:</strong><br/>
        1. Upload a moment while logged in<br/>
        2. That moment should show "✅ YOU OWN THIS"<br/>
        3. Other moments should show "❌ NOT YOURS"<br/>
        4. If ownership is wrong, check the debug info above
      </div>
    </div>
  );
};

export default OwnershipTest;