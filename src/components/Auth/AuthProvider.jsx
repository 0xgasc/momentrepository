import React, { createContext, useContext, useState, useEffect } from 'react';

// API Base URL - Use environment variable or fallback to your deployed backend
const API_BASE_URL = process.env.REACT_APP_API_URL ||
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5050'
    : 'https://momentrepository-production.up.railway.app');

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Decode OAuth error codes to user-friendly messages
const decodeOAuthError = (error) => {
  const errorMessages = {
    'invalid_state': 'Authentication session expired. Please try again.',
    'oauth_failed': 'OAuth authentication failed. Please try again.',
    'discord_email_required': 'Discord email is required. Please verify your Discord email and try again.',
    'account_linked_to_google': 'This email is already linked to a Google account. Please sign in with Google.',
    'account_linked_to_discord': 'This email is already linked to a Discord account. Please sign in with Discord.',
    'access_denied': 'Access was denied. Please try again.'
  };
  return errorMessages[error] || `Authentication error: ${error}`;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [oauthError, setOauthError] = useState(null);

  useEffect(() => {
    // Check for OAuth callback params in URL
    const urlParams = new URLSearchParams(window.location.search);
    const authToken = urlParams.get('auth_token');
    const authUser = urlParams.get('auth_user');
    const authError = urlParams.get('auth_error');

    if (authError) {
      // OAuth error - decode and store
      setOauthError(decodeOAuthError(authError));
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      setLoading(false);
    } else if (authToken && authUser) {
      // OAuth successful - store credentials
      try {
        const userData = JSON.parse(decodeURIComponent(authUser));
        localStorage.setItem('token', authToken);
        localStorage.setItem('user', JSON.stringify(userData));
        setToken(authToken);
        setUser(userData);
      } catch (e) {
        console.error('Failed to parse OAuth user data:', e);
      }
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      setLoading(false);
    } else {
      // Normal init - check localStorage
      const storedToken = localStorage.getItem('token');
      const userData = localStorage.getItem('user');
      if (storedToken && userData) {
        setToken(storedToken);
        setUser(JSON.parse(userData));
      }
      setLoading(false);
    }
  }, []);

  // Initiate OAuth login flows
  const loginWithGoogle = () => {
    window.location.href = `${API_BASE_URL}/auth/google`;
  };

  const loginWithDiscord = () => {
    window.location.href = `${API_BASE_URL}/auth/discord`;
  };

  const clearOauthError = () => {
    setOauthError(null);
  };

  const login = async (email, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        // Handle OAuth account trying password login
        if (error.authProvider) {
          throw new Error(error.error);
        }
        throw new Error(error.error || 'Login failed');
      }

      const data = await response.json();
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      return data;
    } catch (error) {
      throw error;
    }
  };

  const register = async (email, password, displayName) => {
    try {
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Registration failed');
      }

      const data = await response.json();
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      return data;
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      login,
      register,
      logout,
      loading,
      loginWithGoogle,
      loginWithDiscord,
      oauthError,
      clearOauthError
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Export the API_BASE_URL for use in other components
export { API_BASE_URL };
