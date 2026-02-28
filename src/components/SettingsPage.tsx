import { useApp } from "../AppProvider";

// ─── Setting Row: Toggle ──────────────────────────────────────────────────────
function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="settings-row" onClick={() => onChange(!value)}>
      <div className="settings-row-info">
        <span className="settings-row-label">{label}</span>
        {description && (
          <span className="settings-row-desc">{description}</span>
        )}
      </div>
      <button
        className={`settings-toggle ${value ? "on" : "off"}`}
        onClick={(e) => {
          e.stopPropagation();
          onChange(!value);
        }}
        aria-label={`Toggle ${label}`}
      >
        <span className="settings-toggle-thumb" />
      </button>
    </div>
  );
}

// ─── Section Wrapper ──────────────────────────────────────────────────────────
function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <span className="settings-section-icon">{icon}</span>
        <h2 className="settings-section-title">{title}</h2>
      </div>
      <div className="settings-section-body">{children}</div>
    </div>
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────────────
function SettingsPage({ onClose }: { onClose: () => void }) {
  const { settings, updateSetting } = useApp();

  return (
    <div className="settings-overlay">
      <div className="settings-page">
        {/* Header */}
        <div className="settings-header">
          <div className="settings-header-left">
            <span className="settings-header-icon">⚙</span>
            <h1 className="settings-header-title">Settings</h1>
          </div>
          <button className="settings-close-btn" onClick={onClose} title="Close (Esc)">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="settings-content">
          {/* ── Visuals ── */}
          <Section title="Appearance" icon="🎨">
            <div className="settings-theme-grid">
              {(['catppuccin', 'midnight', 'monokai', 'light'] as const).map((t) => (
                <div
                  key={t}
                  className={`theme-option ${settings.theme === t ? 'active' : ''}`}
                  onClick={() => updateSetting('theme', t)}
                >
                  <div className={`theme-preview ${t}`}>
                    <div className="preview-dot primary" />
                    <div className="preview-dot accent" />
                  </div>
                  <span className="theme-name">{t.charAt(0).toUpperCase() + t.slice(1)}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* ── Editor ── */}
          <Section title="Editor" icon="✏️">
            <ToggleRow
              label="AI Auto Completion"
              description="Suggest inline completions while you type using the configured AI model"
              value={settings.autoCompletion}
              onChange={(v) => updateSetting("autoCompletion", v)}
            />
          </Section>
        </div>


        {/* Footer */}
        <div className="settings-footer">
          <span className="settings-footer-note">
            Changes apply immediately — no restart needed.
          </span>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
