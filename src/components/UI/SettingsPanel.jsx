// src/components/UI/SettingsPanel.jsx - Theme and layout settings
import React, { useState, memo } from 'react';
import {
  Settings, X, PanelLeft, PanelRight, PanelTop, PanelBottom,
  Moon, Sun, Palette, Save, Check, Loader2, LogIn
} from 'lucide-react';
import { useTheme, presetColors } from '../../contexts/ThemeContext';

const SettingsPanel = memo(({
  isOpen,
  onClose,
  position,
  onPositionChange,
  user,
  onLoginClick
}) => {
  const {
    accentColor,
    extraDark,
    setAccentColor,
    toggleExtraDark,
    saveToAccount,
    isSyncing
  } = useTheme();

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customColor, setCustomColor] = useState(accentColor);
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

  // Handle custom color change
  const handleCustomColorChange = (e) => {
    const color = e.target.value;
    setCustomColor(color);
    setAccentColor(color);
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
          {/* Sidebar Position */}
          <div>
            <label className="text-xs uppercase tracking-wider text-gray-500 mb-2 block">
              Sidebar Position
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'left', icon: PanelLeft, label: 'Left' },
                { id: 'right', icon: PanelRight, label: 'Right' },
                { id: 'top', icon: PanelTop, label: 'Top' },
                { id: 'bottom', icon: PanelBottom, label: 'Bottom' },
              ].map(pos => {
                const Icon = pos.icon;
                return (
                  <button
                    key={pos.id}
                    onClick={() => onPositionChange(pos.id)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg transition-all ${
                      position === pos.id
                        ? 'bg-[var(--accent-color)]/20 border border-[var(--accent-color)]/50 text-[var(--accent-color)]'
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

          {/* Dark Mode Toggle */}
          <div>
            <label className="text-xs uppercase tracking-wider text-gray-500 mb-2 block">
              Display Mode
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => extraDark && toggleExtraDark()}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg transition-all ${
                  !extraDark
                    ? 'bg-[var(--accent-color)]/20 border border-[var(--accent-color)]/50 text-[var(--accent-color)]'
                    : 'bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700'
                }`}
              >
                <Sun size={18} />
                <span className="text-sm">Normal Dark</span>
              </button>
              <button
                onClick={() => !extraDark && toggleExtraDark()}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg transition-all ${
                  extraDark
                    ? 'bg-[var(--accent-color)]/20 border border-[var(--accent-color)]/50 text-[var(--accent-color)]'
                    : 'bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700'
                }`}
              >
                <Moon size={18} />
                <span className="text-sm">Extra Dark</span>
              </button>
            </div>
          </div>

          {/* Accent Color */}
          <div>
            <label className="text-xs uppercase tracking-wider text-gray-500 mb-2 block">
              <Palette size={12} className="inline mr-1" />
              Accent Color
            </label>

            {/* Preset Colors */}
            <div className="grid grid-cols-8 gap-2 mb-3">
              {presetColors.map(preset => (
                <button
                  key={preset.color}
                  onClick={() => setAccentColor(preset.color)}
                  className={`w-8 h-8 rounded-full transition-all ${
                    accentColor === preset.color
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900 scale-110'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: preset.color }}
                  title={preset.name}
                />
              ))}
            </div>

            {/* Custom Color Picker */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-700 transition-colors"
              >
                <div
                  className="w-4 h-4 rounded-full border border-gray-600"
                  style={{ backgroundColor: accentColor }}
                />
                Custom Color
              </button>
              {showColorPicker && (
                <input
                  type="color"
                  value={customColor}
                  onChange={handleCustomColorChange}
                  className="w-10 h-10 rounded cursor-pointer bg-transparent border-0"
                />
              )}
              <span className="text-xs text-gray-500 font-mono">{accentColor}</span>
            </div>
          </div>

          {/* Preview */}
          <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="text-xs text-gray-500 mb-2">Preview</div>
            <div className="flex items-center gap-3">
              <div
                className="px-3 py-1.5 rounded text-sm font-medium"
                style={{
                  backgroundColor: `rgba(var(--accent-rgb), 0.2)`,
                  color: 'var(--accent-color)',
                  border: `1px solid rgba(var(--accent-rgb), 0.5)`
                }}
              >
                Active Tab
              </div>
              <div
                className="w-3 h-3 rounded-full animate-pulse"
                style={{ backgroundColor: 'var(--accent-color)' }}
              />
              <span style={{ color: 'var(--accent-color)' }} className="text-sm">
                Accent Text
              </span>
            </div>
          </div>

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
                    : 'bg-[var(--accent-color)]/20 text-[var(--accent-color)] border border-[var(--accent-color)]/50 hover:bg-[var(--accent-color)]/30'
                }`}
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
