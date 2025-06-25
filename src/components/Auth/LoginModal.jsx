// src/components/Auth/LoginModal.jsx
import React, { useState, memo } from 'react';
import { useAuth } from './AuthProvider';

const LoginModal = memo(({ onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('login');
  const [message, setMessage] = useState('');
  const { login, register } = useAuth();

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      await login(email, password);
      setMessage('Login successful! Refreshing page...');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      if (err.message.includes('User not found') || err.message.includes('not found')) {
        setMode('userNotFound');
        setError('');
        setMessage('');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    if (!displayName.trim()) {
      setError('Display name is required');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      await register(email, password, displayName);
      setMessage('Account created successfully! Refreshing page...');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (mode === 'login') {
      handleLogin();
    } else if (mode === 'register' || mode === 'userNotFound') {
      handleRegister();
    }
  };

  const switchToRegister = () => {
    setMode('register');
    setError('');
    setMessage('');
    if (!displayName) {
      const emailName = email.split('@')[0];
      setDisplayName(emailName);
    }
  };

  const switchToLogin = () => {
    setMode('login');
    setError('');
    setMessage('');
    setDisplayName('');
  };

  const startOver = () => {
    setMode('login');
    setError('');
    setMessage('');
    setEmail('');
    setPassword('');
    setDisplayName('');
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {mode === 'login' ? 'Welcome Back' : 
           mode === 'userNotFound' ? 'Create Account' : 
           'Create Account'}
        </h2>
        <p className="text-gray-600 mt-2">
          {mode === 'login' ? 'Sign in to upload and manage your UMO moments' :
           mode === 'userNotFound' ? 'Set up your new account to get started' :
           'Join the UMO community and start collecting moments'}
        </p>
      </div>
      
      {message && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4 text-center">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600 mr-2"></div>
            {message}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {mode === 'userNotFound' && (
        <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-4 text-center">
          <p className="font-medium">No account found for {email}</p>
          <p className="text-sm mt-1">Would you like to create a new account with this email?</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {(mode === 'register' || mode === 'userNotFound') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Display Name *
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="How others will see you"
              required
            />
          </div>
        )}
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email *
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="your@email.com"
            required
            disabled={mode === 'userNotFound' && loading}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password *
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={mode === 'login' ? 'Enter your password' : 'Create a password (min 6 characters)'}
            required
            minLength={mode !== 'login' ? 6 : undefined}
          />
        </div>
        
        <button
          type="submit"
          disabled={loading || !email || !password || ((mode === 'register' || mode === 'userNotFound') && !displayName)}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              {mode === 'login' ? 'Signing In...' : 'Creating Account...'}
            </div>
          ) : (
            mode === 'login' ? 'Sign In' : 'Create Account'
          )}
        </button>
      </form>
      
      <div className="text-center mt-6">
        {mode === 'login' ? (
          <button
            onClick={switchToRegister}
            className="text-blue-600 hover:text-blue-800 underline"
            disabled={loading}
          >
            Don't have an account? Create one
          </button>
        ) : mode === 'userNotFound' ? (
          <button
            onClick={startOver}
            className="text-gray-600 hover:text-gray-800 underline"
            disabled={loading}
          >
            Try different email address
          </button>
        ) : (
          <button
            onClick={switchToLogin}
            className="text-blue-600 hover:text-blue-800 underline"
            disabled={loading}
          >
            Already have an account? Sign in
          </button>
        )}
      </div>
    </div>
  );
});

LoginModal.displayName = 'LoginModal';

export default LoginModal;