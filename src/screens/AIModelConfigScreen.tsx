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

// ─── Setting Row: Input ──────────────────────────────────────────────────────
function InputRow({
  label,
  description,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  description?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="settings-row no-cursor">
      <div className="settings-row-info">
        <span className="settings-row-label">{label}</span>
        {description && (
          <span className="settings-row-desc">{description}</span>
        )}
      </div>
      <input
        className="model-input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: "200px" }}
      />
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

// ─── Main AI Config Page ─────────────────────────────────────────────────────
function AIModelConfigScreen({ onClose }: { onClose: () => void }) {
  const { settings, updateSetting } = useApp();

  return (
    <div className="settings-overlay">
      <div className="settings-page ai-config-page">
        {/* Header */}
        <div className="settings-header">
          <div className="settings-header-left">
            <span className="settings-header-icon">🧠</span>
            <h1 className="settings-header-title">AI Model Configuration</h1>
          </div>
          <button className="settings-close-btn" onClick={onClose} title="Close (Esc)">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="settings-content">
          {/* ── Auto Completion ── */}
          <Section title="Auto Completion" icon="⚡">
            <ToggleRow
              label="AI Auto Completion"
              description="Suggest inline completions while you type using the configured AI model"
              value={settings.autoCompletion}
              onChange={(v) => updateSetting("autoCompletion", v)}
            />
          </Section>

          {/* ── Model Settings ── */}
          <Section title="Model Settings" icon="🤖">
            <InputRow
              label="Model Name"
              description="The name of the AI model to use for completions and chat (e.g., gpt-4, claude-3-opus, etc.)"
              value={settings.aiModel}
              onChange={(v) => updateSetting("aiModel", v)}
              placeholder="e.g. gpt-3.5-turbo"
            />
          </Section>

          {/* ── Advanced ── */}
          <Section title="Premium Features" icon="✨">
             <div className="settings-row-desc" style={{ padding: "8px 4px" }}>
                More advanced AI settings like temperature, max tokens, and system prompts will be available soon.
             </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="settings-footer">
          <span className="settings-footer-note">
            Using model: <span style={{ color: "var(--accent)", fontWeight: "bold" }}>{settings.aiModel}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default AIModelConfigScreen;
