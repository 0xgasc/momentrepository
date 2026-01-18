// src/contexts/ThemeContext.jsx - Theme settings (accent color, dark mode)
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth, API_BASE_URL } from '../components/Auth/AuthProvider';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

// Default theme
const defaultTheme = {
  accentColor: '#eab308', // yellow-500
  extraDark: true // Always extra dark by default
};

// Preset colors for quick selection
export const presetColors = [
  { name: 'Yellow', color: '#eab308' },
  { name: 'Orange', color: '#f97316' },
  { name: 'Red', color: '#ef4444' },
  { name: 'Pink', color: '#ec4899' },
  { name: 'Purple', color: '#a855f7' },
  { name: 'Blue', color: '#3b82f6' },
  { name: 'Cyan', color: '#06b6d4' },
  { name: 'Green', color: '#22c55e' },
];

export const ThemeProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [theme, setTheme] = useState(() => {
    // Load from localStorage on init
    const saved = localStorage.getItem('umo-theme');
    if (saved) {
      try {
        return { ...defaultTheme, ...JSON.parse(saved) };
      } catch (e) {
        return defaultTheme;
      }
    }
    return defaultTheme;
  });

  const [isSyncing, setIsSyncing] = useState(false);

  // Apply CSS variables when theme changes
  useEffect(() => {
    const root = document.documentElement;

    // Set accent color CSS variable
    root.style.setProperty('--accent-color', theme.accentColor);

    // Calculate RGB values for opacity variants
    const hex = theme.accentColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    root.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);

    // Apply extra dark mode
    if (theme.extraDark) {
      root.classList.add('extra-dark');
    } else {
      root.classList.remove('extra-dark');
    }

    // Save to localStorage
    localStorage.setItem('umo-theme', JSON.stringify(theme));
  }, [theme]);

  // Load theme from user account when logged in
  useEffect(() => {
    const loadUserTheme = async () => {
      if (!user || !token) return;

      try {
        const response = await fetch(`${API_BASE_URL}/api/users/me/preferences`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.preferences?.theme) {
            setTheme(prev => ({ ...prev, ...data.preferences.theme }));
          }
        }
      } catch (err) {
        console.log('Could not load user theme preferences');
      }
    };

    loadUserTheme();
  }, [user, token]);

  // Update accent color
  const setAccentColor = useCallback((color) => {
    setTheme(prev => ({ ...prev, accentColor: color }));
  }, []);

  // Toggle extra dark mode
  const toggleExtraDark = useCallback(() => {
    setTheme(prev => ({ ...prev, extraDark: !prev.extraDark }));
  }, []);

  // Set extra dark mode explicitly
  const setExtraDark = useCallback((value) => {
    setTheme(prev => ({ ...prev, extraDark: value }));
  }, []);

  // Save theme to user account
  const saveToAccount = useCallback(async () => {
    if (!user || !token) {
      return { success: false, needsLogin: true };
    }

    setIsSyncing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/me/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ theme })
      });

      if (response.ok) {
        setIsSyncing(false);
        return { success: true };
      } else {
        setIsSyncing(false);
        return { success: false, error: 'Failed to save' };
      }
    } catch (err) {
      setIsSyncing(false);
      return { success: false, error: err.message };
    }
  }, [user, token, theme]);

  // Reset to defaults
  const resetTheme = useCallback(() => {
    setTheme(defaultTheme);
  }, []);

  const value = {
    theme,
    accentColor: theme.accentColor,
    extraDark: theme.extraDark,
    setAccentColor,
    toggleExtraDark,
    setExtraDark,
    saveToAccount,
    resetTheme,
    isSyncing,
    presetColors
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
