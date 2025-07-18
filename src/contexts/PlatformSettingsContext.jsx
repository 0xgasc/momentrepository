// Platform Settings Context - Global settings management
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const PlatformSettingsContext = createContext();

export const usePlatformSettings = () => {
  const context = useContext(PlatformSettingsContext);
  if (!context) {
    throw new Error('usePlatformSettings must be used within a PlatformSettingsProvider');
  }
  return context;
};

export const PlatformSettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // API Base URL - Use environment variable or fallback to your deployed backend
  const API_BASE_URL = process.env.REACT_APP_API_URL || 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:5050'  
      : 'https://your-backend-url.com');

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_BASE_URL}/platform/settings`);
      
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
      } else {
        throw new Error('Failed to fetch platform settings');
      }
    } catch (err) {
      console.error('❌ Platform settings fetch error:', err);
      setError(err.message);
      
      // Fallback settings if fetch fails
      setSettings({
        web3Enabled: true,
        maintenanceMode: false,
        uploadsEnabled: true,
        platformName: 'UMO Archive',
        platformDescription: 'Decentralized concert moment platform',
        maxFileSize: 6442450944 // 6GB
      });
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Helper function to check if Web3 features should be shown
  const isWeb3Enabled = () => {
    return settings?.web3Enabled && !settings?.maintenanceMode;
  };

  // Helper function to check if uploads are allowed
  const areUploadsEnabled = () => {
    return settings?.uploadsEnabled && !settings?.maintenanceMode;
  };

  // Helper function to check if platform is in maintenance mode
  const isMaintenanceMode = () => {
    return settings?.maintenanceMode;
  };

  // Helper function to get platform display info
  const getPlatformInfo = () => {
    return {
      name: settings?.platformName || 'UMO Archive',
      description: settings?.platformDescription || 'Decentralized concert moment platform',
      maxFileSize: settings?.maxFileSize || 6442450944
    };
  };

  const value = {
    settings,
    loading,
    error,
    isWeb3Enabled,
    areUploadsEnabled,
    isMaintenanceMode,
    getPlatformInfo,
    refetchSettings: fetchSettings
  };

  return (
    <PlatformSettingsContext.Provider value={value}>
      {children}
    </PlatformSettingsContext.Provider>
  );
};