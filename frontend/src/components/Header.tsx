import React from 'react';
import { HealthStatus } from '../types/domain';
import { formatUtcTimestamp } from '../utils/categories';

interface HeaderProps {
  health: HealthStatus;
  lastUpdatedAt: string;
  liteMode: boolean;
  onToggleLiteMode: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onSyncNow: () => void;
  isSyncing: boolean;
  showDisclaimersModal: boolean;
  onToggleDisclaimersModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  lastUpdatedAt,
  liteMode,
  onToggleLiteMode,
  soundEnabled,
  onToggleSound,
  onSyncNow,
  isSyncing,
  showDisclaimersModal,
  onToggleDisclaimersModal,
}) => {
  const isCachedFallback =
    health.cache_freshness === 'cached_fallback' ||
    health.cache_freshness === 'stale' ||
    health.status === 'degraded';

  return (
    <header className="top-header" role="banner">
      <div className="header-brand">
        <div className="brand-emblem" aria-hidden="true">
          <span className="brand-pulse-ring" />
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
            <path d="M2 12h20" />
          </svg>
        </div>
        <div>
          <h1 className="brand-title">
            EARTH EMDS <span className="brand-divider">//</span>{' '}
            <span className="brand-subtitle">Earth Event &amp; Disaster Monitor</span>
          </h1>
          <p className="brand-tagline">
            NASA EONET v3 Telemetry · PostGIS &amp; REST Countries v3.1 · Rule-Based NewsAPI v2
          </p>
        </div>
      </div>

      <div className="header-controls">
        {/* Live Freshness Pill */}
        <div
          className={`freshness-pill ${isCachedFallback ? 'freshness-cached' : 'freshness-live'}`}
          data-testid="freshness-pill"
          title="Last synchronized snapshot timestamp"
        >
          <span className="freshness-dot" />
          <span className="freshness-status">
            {isCachedFallback ? 'CACHED SNAPSHOT' : 'LIVE TELEMETRY'}
          </span>
          <span className="freshness-time mono-text" data-testid="last-updated-timestamp">
            {formatUtcTimestamp(lastUpdatedAt || health.last_updated_at)}
          </span>
        </div>

        {/* Sync Now Button */}
        <button
          type="button"
          className="header-btn"
          onClick={onSyncNow}
          disabled={isSyncing}
          data-testid="sync-now-button"
          aria-label="Synchronize latest hazard telemetry now"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={isSyncing ? 'spin-icon' : ''}
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 16h5v5" />
          </svg>
          <span>{isSyncing ? 'Syncing…' : 'Sync Now'}</span>
        </button>

        {/* 1-Click Lite Mode Toggle */}
        <button
          type="button"
          className={`header-btn ${liteMode ? 'header-btn-active-amber' : 'header-btn-active-cyan'}`}
          onClick={onToggleLiteMode}
          aria-pressed={liteMode}
          data-testid="lite-mode-toggle"
          title="Toggle between On-Demand 3D Globe and Zero-GPU 2D Tactical List Mode"
        >
          <span className="mode-badge-dot" />
          <span>{liteMode ? 'Lite Mode — GPU Off' : 'Lite Mode (2D List)'}</span>
        </button>

        {/* Sound FX Mute / Unmute Toggle */}
        <button
          type="button"
          className={`header-btn ${soundEnabled ? 'header-btn-sound-on' : 'header-btn-sound-off'}`}
          onClick={onToggleSound}
          aria-pressed={soundEnabled}
          data-testid="sound-fx-toggle"
          aria-label={soundEnabled ? 'Mute Sound FX' : 'Unmute Sound FX'}
        >
          {soundEnabled ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          )}
          <span>{soundEnabled ? 'Sound FX: ON' : 'Sound FX: OFF'}</span>
        </button>

        {/* Data Disclaimers Info Trigger */}
        <button
          type="button"
          className={`header-btn ${showDisclaimersModal ? 'header-btn-active-cyan' : ''}`}
          onClick={onToggleDisclaimersModal}
          aria-expanded={showDisclaimersModal}
          data-testid="disclaimers-trigger"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span>Data Disclaimers</span>
        </button>
      </div>
    </header>
  );
};
