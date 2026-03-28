import React from "react";

function ShortcutRow({
  label,
  keys,
}: {
  label: string;
  keys: string[];
}) {
  return (
    <div className="settings-row no-cursor">
      <div className="settings-row-info">
        <span className="settings-row-label">{label}</span>
      </div>
      <div className="shortcut-keys">
        {keys.map((k, i) => (
          <kbd key={i} className="shortcut-key">{k}</kbd>
        ))}
      </div>
    </div>
  );
}

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

export default function ShortcutsScreen({ onClose }: { onClose: () => void }) {
  return (
    <div className="settings-overlay">
      <div className="settings-page shortcuts-page">
        {/* Header */}
        <div className="settings-header">
          <div className="settings-header-left">
            <span className="settings-header-icon">⌨</span>
            <h1 className="settings-header-title">Keyboard Shortcuts</h1>
          </div>
          <button className="settings-close-btn" onClick={onClose} title="Close (Esc)">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="settings-content">
          <Section title="General" icon="🏠">
            <ShortcutRow label="Open Settings" keys={["Ctrl", ","]} />
            <ShortcutRow label="AI Model Config" keys={["Ctrl", "Shift", "M"]} />
            <ShortcutRow label="Keyboard Shortcuts" keys={["Ctrl", "/"]} />
          </Section>

          <Section title="Layout" icon="📐">
            <ShortcutRow label="Toggle Sidebar" keys={["Ctrl", "B"]} />
            <ShortcutRow label="Toggle AI Chat" keys={["Ctrl", "J"]} />
          </Section>

          <Section title="Editor" icon="✏️">
            <ShortcutRow label="Save File" keys={["Ctrl", "S"]} />
            <ShortcutRow label="Search" keys={["Ctrl", "F"]} />
            <ShortcutRow label="Command Palette" keys={["F1"]} />
          </Section>
        </div>

        {/* Footer */}
        <div className="settings-footer">
          <span className="settings-footer-note">
            Master these shortcuts to work faster.
          </span>
        </div>
      </div>
    </div>
  );
}
