// src/components/UI/SettingsPanel.jsx - Theme and layout settings
import React, { useState, memo } from 'react';
import {
  Settings, X, PanelTop, PanelBottom,
  Save, Check, Loader2, LogIn
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const SettingsPanel = memo(({
  isOpen,
  onClose,
  position,
  onPositionChange,
  user,
  onLoginClick
}) => {
  const {
    saveToAccount,
    isSyncing
  } = useTheme();

  const [saveStatus, setSaveStatus] = useState(null); // 'success' | 'error' | null

  // Handle save to account
  const handleSave = async () => {
    const result = await saveToAccount();
    if (result.success) {
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 2000);
    } else if (result.needsLogin) {
      // Show login prompt
      onLoginClick?.();
    } else {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800/50">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-gray-400" />
            <h2 className="text-lg font-semibold text-white">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Menu Bar Position - Top/Bottom only */}
          <div>
            <label className="text-xs uppercase tracking-wider text-gray-500 mb-2 block">
              Menu Bar Position
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'top', icon: PanelTop, label: 'Top' },
                { id: 'bottom', icon: PanelBottom, label: 'Bottom' },
              ].map(pos => {
                const Icon = pos.icon;
                const isActive = position === pos.id;
                return (
                  <button
                    key={pos.id}
                    onClick={() => onPositionChange(pos.id)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg transition-all ${
                      isActive
                        ? 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-400'
                        : 'bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    <Icon size={20} />
                    <span className="text-xs">{pos.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Accent Color section removed */}

          {/* Save Button */}
          <div className="pt-2 border-t border-gray-700">
            {user ? (
              <button
                onClick={handleSave}
                disabled={isSyncing}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
                  saveStatus === 'success'
                    ? 'bg-green-600/20 text-green-400 border border-green-500/50'
                    : saveStatus === 'error'
                    ? 'bg-red-600/20 text-red-400 border border-red-500/50'
                    : ''
                }`}
                style={!saveStatus ? {
                  backgroundColor: 'rgba(234, 179, 8, 0.2)',
                  color: '#eab308',
                  border: '1px solid rgba(234, 179, 8, 0.5)'
                } : {}}
              >
                {isSyncing ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Saving...
                  </>
                ) : saveStatus === 'success' ? (
                  <>
                    <Check size={18} />
                    Saved to Account
                  </>
                ) : saveStatus === 'error' ? (
                  <>
                    <X size={18} />
                    Failed to Save
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Save to Account
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={onLoginClick}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 transition-colors"
              >
                <LogIn size={18} />
                Login to Save Settings
              </button>
            )}
            <p className="text-xs text-gray-500 text-center mt-2">
              Settings are saved locally. Login to sync across devices.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});

SettingsPanel.displayName = 'SettingsPanel';

export default SettingsPanel;
